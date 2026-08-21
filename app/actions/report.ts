'use server';

import { aliasedTable, and, asc, desc, eq, gt, lt } from 'drizzle-orm';

import { banUser } from '@/app/actions/moderation';

import { db } from '@/lib/db';
import { chatParticipant, message, post, report, user } from '@/lib/db/schema';
import { generateReportReference, newId } from '@/lib/id';
import { requireRole } from '@/lib/roles-server';
import { getCurrentUser } from '@/lib/session';
import { sendSystemDM } from '@/lib/system-messages';
import { isSystemUser } from '@/lib/system-user';
import type {
  ReportedMessageContextItem,
  ReportListItem,
  ReportStatus,
  ReportTargetKind,
  ReportVerdict,
} from '@/lib/types';

// Generate a report reference that isn't already in use. The code space is
// large (30^6), so a couple of retries is plenty to dodge the rare collision.
async function uniqueReportReference(): Promise<string> {
  let candidate = generateReportReference();
  for (let i = 0; i < 5; i++) {
    const [taken] = await db
      .select({ id: report.id })
      .from(report)
      .where(eq(report.reference, candidate))
      .limit(1);
    if (!taken) return candidate;
    candidate = generateReportReference();
  }
  return candidate;
}

// File a report against a user, or against a specific post or chat message they
// authored. Exactly one of `postId` / `messageId` may be set to pin the target;
// with neither, it's a plain user report. The reporter immediately receives a
// System DM confirming receipt with a reference code they can be told the
// outcome of later (see resolveReport).
export async function reportUser({
  reportedUserId,
  chatId,
  postId,
  messageId,
  reason,
}: {
  reportedUserId: string;
  chatId?: string;
  postId?: string;
  messageId?: string;
  reason?: string;
}): Promise<{ ok: true; reference: string }> {
  const me = await getCurrentUser();

  if (me.id === reportedUserId) {
    throw new Error('You cannot report yourself');
  }
  if (isSystemUser(reportedUserId)) {
    throw new Error('This account cannot be reported');
  }

  // The reported user must exist.
  const [target] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.id, reportedUserId))
    .limit(1);
  if (!target) throw new Error('User not found');

  // If a chatId is provided, verify the reporter is actually in that chat.
  if (chatId) {
    const [membership] = await db
      .select({ id: chatParticipant.id })
      .from(chatParticipant)
      .where(
        and(
          eq(chatParticipant.chatId, chatId),
          eq(chatParticipant.userId, me.id),
        ),
      )
      .limit(1);
    if (!membership) throw new Error('Not a member of this chat');
  }

  // Resolve + validate the pinned target (post/message must belong to the
  // reported user), and settle the report's target kind.
  let target_kind: ReportTargetKind = 'USER';
  let resolvedPostId: string | null = null;
  let resolvedMessageId: string | null = null;

  if (postId) {
    const [p] = await db
      .select({ id: post.id, userId: post.userId })
      .from(post)
      .where(eq(post.id, postId))
      .limit(1);
    if (!p) throw new Error('Post not found');
    if (p.userId !== reportedUserId) {
      throw new Error('That post does not belong to the reported user');
    }
    resolvedPostId = p.id;
    target_kind = 'POST';
  } else if (messageId) {
    const [m] = await db
      .select({ id: message.id, senderId: message.senderId })
      .from(message)
      .where(eq(message.id, messageId))
      .limit(1);
    if (!m) throw new Error('Message not found');
    if (m.senderId !== reportedUserId) {
      throw new Error('That message does not belong to the reported user');
    }
    resolvedMessageId = m.id;
    target_kind = 'MESSAGE';
  }

  const reference = await uniqueReportReference();
  const trimmedReason = reason?.trim() || null;

  await db.insert(report).values({
    id: newId('rep'),
    reporterId: me.id,
    reportedUserId,
    chatId: chatId ?? null,
    postId: resolvedPostId,
    messageId: resolvedMessageId,
    reason: trimmedReason,
    reference,
    status: 'PENDING',
  });

  // Confirm receipt to the reporter over a System DM. Structured meta carries
  // the reference; the preview text is only the messages-list/notification blurb.
  void sendSystemDM(
    me.id,
    { kind: 'REPORT_FILED', reference },
    `Thanks — your report was received (ref ${reference}). Our team will review it.`,
  );

  return { ok: true, reference };
}

// Resolve a pending report with a verdict. Moderators+ only. A GUILTY verdict
// MUST be backed by a real enforcement action, so it carries the ban details and
// actually bans the reported user (reusing banUser, which enforces the same rank
// and self guards as the moderation panel). NOT_GUILTY just records the ruling.
// Either way the reporter is notified over a System DM referencing the same code,
// so they learn the outcome without exposing who they reported or any internal
// detail.
export async function resolveReport(
  reportId: string,
  verdict: ReportVerdict,
  banOptions?: { reason: string; durationDays: number | null; banIp?: boolean },
): Promise<{ ok: true; ipBanned: boolean }> {
  await requireRole('MODERATOR');
  const me = await getCurrentUser();

  if (verdict !== 'GUILTY' && verdict !== 'NOT_GUILTY') {
    throw new Error('Invalid verdict');
  }

  const [row] = await db
    .select({
      id: report.id,
      reporterId: report.reporterId,
      reportedUserId: report.reportedUserId,
      reference: report.reference,
      status: report.status,
    })
    .from(report)
    .where(eq(report.id, reportId))
    .limit(1);
  if (!row) throw new Error('Report not found');
  if (row.status === 'RESOLVED') throw new Error('Report already resolved');

  // A guilty verdict enforces a ban FIRST. banUser applies the rank rules (a
  // moderator can't ban an admin/moderator) and the self-ban guard; if it
  // throws, we bail before touching the report, so the row stays pending and
  // nothing falsely tells the reporter "action was taken".
  let ipBanned = false;
  if (verdict === 'GUILTY') {
    const reason = banOptions?.reason?.trim();
    if (!reason) {
      throw new Error('A ban reason is required to mark a report guilty');
    }
    const res = await banUser(row.reportedUserId, {
      reason,
      durationDays: banOptions?.durationDays ?? null,
      banIp: banOptions?.banIp,
    });
    ipBanned = res.ipBanned;
  }

  const reference = row.reference ?? (await uniqueReportReference());

  await db
    .update(report)
    .set({
      status: 'RESOLVED',
      verdict,
      reviewedById: me.id,
      reviewedAt: new Date(),
      // Backfill a reference on legacy rows that never had one.
      reference,
    })
    .where(eq(report.id, reportId));

  const preview =
    verdict === 'GUILTY'
      ? `Your report (ref ${reference}) was reviewed — the account was found in violation and action was taken.`
      : `Your report (ref ${reference}) was reviewed — no violation was found.`;
  void sendSystemDM(
    row.reporterId,
    { kind: 'REPORT_RESOLVED', reference, verdict },
    preview,
  );

  return { ok: true, ipBanned };
}

// List reports for the moderator queue, newest first, optionally filtered by
// status. Joins both parties' display fields and a snapshot of the reported
// post/message so a moderator can triage each row inline. Moderators+ only.
export async function listReports(
  filter: ReportStatus | 'ALL' = 'PENDING',
): Promise<ReportListItem[]> {
  await requireRole('MODERATOR');

  const reporter = aliasedTable(user, 'reporter');
  const reported = aliasedTable(user, 'reported');
  const reviewer = aliasedTable(user, 'reviewer');

  const where =
    filter === 'ALL' ? undefined : eq(report.status, filter);

  const rows = await db
    .select({
      id: report.id,
      reference: report.reference,
      reason: report.reason,
      status: report.status,
      verdict: report.verdict,
      postId: report.postId,
      messageId: report.messageId,
      createdAt: report.createdAt,
      reviewedAt: report.reviewedAt,
      reviewedById: reviewer.id,
      reviewedByName: reviewer.name,
      reviewedByUsername: reviewer.username,
      reviewedByImage: reviewer.image,
      reporterId: reporter.id,
      reporterName: reporter.name,
      reporterUsername: reporter.username,
      reporterImage: reporter.image,
      reportedId: reported.id,
      reportedName: reported.name,
      reportedUsername: reported.username,
      reportedImage: reported.image,
      postImageUrl: post.imageUrl,
      postCaption: post.caption,
      postDeletedAt: post.deletedAt,
      chatId: report.chatId,
      messageContent: message.content,
      messageImageUrl: message.imageUrl,
      messageDeletedAt: message.deletedAt,
    })
    .from(report)
    .leftJoin(reporter, eq(reporter.id, report.reporterId))
    .leftJoin(reported, eq(reported.id, report.reportedUserId))
    .leftJoin(reviewer, eq(reviewer.id, report.reviewedById))
    .leftJoin(post, eq(post.id, report.postId))
    .leftJoin(message, eq(message.id, report.messageId))
    .where(where)
    .orderBy(desc(report.createdAt))
    .limit(200);

  return rows.map((r) => {
    const target: ReportTargetKind = r.postId
      ? 'POST'
      : r.messageId
        ? 'MESSAGE'
        : 'USER';
    return {
      id: r.id,
      reference: r.reference ?? '—',
      target,
      reason: r.reason ?? null,
      status: r.status === 'RESOLVED' ? 'RESOLVED' : 'PENDING',
      verdict:
        r.verdict === 'GUILTY'
          ? 'GUILTY'
          : r.verdict === 'NOT_GUILTY'
            ? 'NOT_GUILTY'
            : null,
      createdAt: r.createdAt.toISOString(),
      reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
      reviewedBy: r.reviewedById
        ? {
            id: r.reviewedById,
            name: r.reviewedByName ?? 'Unknown',
            username: r.reviewedByUsername,
            image: r.reviewedByImage,
          }
        : null,
      reporter: r.reporterId
        ? {
            id: r.reporterId,
            name: r.reporterName ?? 'Unknown',
            username: r.reporterUsername,
            image: r.reporterImage,
          }
        : null,
      reportedUser: r.reportedId
        ? {
            id: r.reportedId,
            name: r.reportedName ?? 'Unknown',
            username: r.reportedUsername,
            image: r.reportedImage,
          }
        : null,
      chatId: r.chatId ?? null,
      // Retain the reported content even after deletion (deleted flag set) so a
      // moderator can still verify the report; the row is only gone once the
      // background purge hard-removes it past the 30-day window.
      post: r.postId
        ? {
            id: r.postId,
            imageUrl: r.postImageUrl,
            caption: r.postCaption,
            deleted: r.postDeletedAt != null,
          }
        : null,
      message: r.messageId
        ? {
            id: r.messageId,
            content: r.messageContent,
            imageUrl: r.messageImageUrl,
            deleted: r.messageDeletedAt != null,
          }
        : null,
    };
  });
}

// Count of still-pending reports, for the dashboard badge. Moderators+ only.
export async function countPendingReports(): Promise<number> {
  await requireRole('MODERATOR');
  const rows = await db
    .select({ id: report.id })
    .from(report)
    .where(eq(report.status, 'PENDING'));
  return rows.length;
}

// A prior report against a user, for the history panel shown while triaging a
// report. Compact on purpose: no joined parties (the queue row already shows
// them) — just enough to judge whether this is repeat behaviour.
export type ReportHistoryItem = {
  id: string;
  reference: string;
  target: ReportTargetKind;
  reason: string | null;
  status: ReportStatus;
  verdict: ReportVerdict | null;
  createdAt: string;
  reviewedAt: string | null;
};

// Every report ever filed against a user, newest first. Moderators+ only.
// Backs the reported-user history on a report card, alongside getBanHistory.
export async function listReportsAgainstUser(
  userId: string,
): Promise<ReportHistoryItem[]> {
  await requireRole('MODERATOR');

  const rows = await db
    .select({
      id: report.id,
      reference: report.reference,
      postId: report.postId,
      messageId: report.messageId,
      reason: report.reason,
      status: report.status,
      verdict: report.verdict,
      createdAt: report.createdAt,
      reviewedAt: report.reviewedAt,
    })
    .from(report)
    .where(eq(report.reportedUserId, userId))
    .orderBy(desc(report.createdAt))
    .limit(100);

  return rows.map((r) => ({
    id: r.id,
    reference: r.reference ?? '—',
    target: r.postId ? 'POST' : r.messageId ? 'MESSAGE' : 'USER',
    reason: r.reason ?? null,
    status: r.status === 'RESOLVED' ? 'RESOLVED' : 'PENDING',
    verdict:
      r.verdict === 'GUILTY'
        ? 'GUILTY'
        : r.verdict === 'NOT_GUILTY'
          ? 'NOT_GUILTY'
          : null,
    createdAt: r.createdAt.toISOString(),
    reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
  }));
}

// How many messages of surrounding context to load on each side of a reported
// message. Enough to read the exchange without pulling a whole conversation.
const CONTEXT_WINDOW = 8;

// Load the conversation around a reported message so a moderator can judge it in
// context rather than in isolation — the reported line plus up to CONTEXT_WINDOW
// messages before and after it, oldest-first. Moderators+ only. Content is the
// raw stored text even for soft-deleted rows (moderation must see what was
// said); each item flags whether it's the reported message and whether its
// sender is the reported user. Returns [] if the report doesn't target a
// message, or the message was hard-purged past the retention window.
export async function getReportedMessageContext(
  reportId: string,
): Promise<ReportedMessageContextItem[]> {
  await requireRole('MODERATOR');

  const [row] = await db
    .select({
      reportedUserId: report.reportedUserId,
      messageId: report.messageId,
    })
    .from(report)
    .where(eq(report.id, reportId))
    .limit(1);
  if (!row || !row.messageId) return [];

  // Anchor on the reported message itself (chat + timestamp) to window around it.
  const [anchor] = await db
    .select({
      id: message.id,
      chatId: message.chatId,
      createdAt: message.createdAt,
    })
    .from(message)
    .where(eq(message.id, row.messageId))
    .limit(1);
  if (!anchor) return [];

  const fields = {
    id: message.id,
    senderId: message.senderId,
    kind: message.kind,
    content: message.content,
    imageUrl: message.imageUrl,
    deletedAt: message.deletedAt,
    createdAt: message.createdAt,
    senderName: user.name,
    senderImage: user.image,
  };

  // Messages before the anchor (newest of them first, so limit trims the far
  // past), and messages after it (oldest first). The anchor is fetched with the
  // "after" side via >=, so it's always included even if timestamps collide.
  const [beforeRows, fromAnchorRows] = await Promise.all([
    db
      .select(fields)
      .from(message)
      .leftJoin(user, eq(user.id, message.senderId))
      .where(
        and(eq(message.chatId, anchor.chatId), lt(message.createdAt, anchor.createdAt)),
      )
      .orderBy(desc(message.createdAt))
      .limit(CONTEXT_WINDOW),
    db
      .select(fields)
      .from(message)
      .leftJoin(user, eq(user.id, message.senderId))
      .where(
        and(eq(message.chatId, anchor.chatId), gt(message.createdAt, anchor.createdAt)),
      )
      .orderBy(asc(message.createdAt))
      .limit(CONTEXT_WINDOW),
  ]);

  // The anchor row itself, joined the same way.
  const [anchorRow] = await db
    .select(fields)
    .from(message)
    .leftJoin(user, eq(user.id, message.senderId))
    .where(eq(message.id, anchor.id))
    .limit(1);

  const ordered = [
    ...beforeRows.reverse(),
    ...(anchorRow ? [anchorRow] : []),
    ...fromAnchorRows,
  ];

  return ordered.map((m) => ({
    id: m.id,
    senderId: m.senderId,
    senderName: m.senderName ?? 'Unknown',
    senderImage: m.senderImage ?? null,
    system: m.kind === 'SYSTEM',
    content: m.content ?? null,
    imageUrl: m.imageUrl ?? null,
    deleted: m.deletedAt != null,
    createdAt: m.createdAt.toISOString(),
    isReported: m.id === anchor.id,
    isReportedUser: m.senderId === row.reportedUserId,
  }));
}
