'use server';

import { db } from '@/lib/db';
import {
  ban,
  bannedIp,
  chatParticipant,
  interest,
  invite,
  message,
  notification,
  post,
  postLike,
  randomQueue,
  report,
  session,
  user,
} from '@/lib/db/schema';
import { newId } from '@/lib/id';
import { normalizeRole, type Role } from '@/lib/roles';
import { requireRole } from '@/lib/roles-server';
import { getCurrentUser } from '@/lib/session';
import {
  aliasedTable,
  and,
  count,
  desc,
  eq,
  inArray,
  isNull,
  or,
  sql,
} from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export type AdminUserRow = {
  id: string;
  name: string;
  username: string | null;
  email: string;
  image: string | null;
  role: Role;
  isSelf: boolean;
  isBanned: boolean;
  banExpiresAt: string | null;
};

export type BanHistoryEntry = {
  id: string;
  scope: 'ACCOUNT' | 'IP';
  reason: string;
  ipAddress: string | null;
  bannedById: string | null;
  bannedByName: string | null;
  bannedByAvatar: string | null;
  createdAt: string;
  // null = permanent.
  expiresAt: string | null;
  liftedAt: string | null;
  liftedById: string | null;
  liftedByName: string | null;
  liftedByAvatar: string | null;
  liftReason: string | null;
  active: boolean;
};

// List users for the admin panel, optionally filtered by a search query.
export async function listUsersForAdmin(query = ''): Promise<AdminUserRow[]> {
  await requireRole('ADMIN');
  const me = await getCurrentUser();

  const q = query.trim().toLowerCase();
  const where = q
    ? or(
        sql`lower(${user.name}) like ${'%' + q + '%'}`,
        sql`lower(${user.username}) like ${'%' + q + '%'}`,
        sql`lower(${user.email}) like ${'%' + q + '%'}`,
      )
    : undefined;

  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      image: user.image,
      role: user.role,
      isBanned: user.isBanned,
      banExpiresAt: user.banExpiresAt,
    })
    .from(user)
    .where(where)
    .orderBy(desc(user.createdAt))
    .limit(100);

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    username: r.username,
    email: r.email,
    image: r.image,
    role: normalizeRole(r.role),
    isSelf: r.id === me.id,
    isBanned: r.isBanned,
    banExpiresAt: r.banExpiresAt ? r.banExpiresAt.toISOString() : null,
  }));
}

// Change a user's role. Admin-only. Prevents demoting the last remaining admin.
export async function setUserRole(targetUserId: string, role: Role) {
  await requireRole('ADMIN');
  const me = await getCurrentUser();

  if (!['ADMIN', 'MODERATOR', 'MEMBER'].includes(role)) {
    throw new Error('Invalid role');
  }

  const [target] = await db
    .select({ id: user.id, role: user.role })
    .from(user)
    .where(eq(user.id, targetUserId))
    .limit(1);
  if (!target) throw new Error('User not found');

  // Guard: don't allow removing the final admin (including self-demotion).
  if (normalizeRole(target.role) === 'ADMIN' && role !== 'ADMIN') {
    const [{ value: adminCount }] = await db
      .select({ value: count() })
      .from(user)
      .where(eq(user.role, 'ADMIN'));
    if (Number(adminCount) <= 1) {
      throw new Error('There must be at least one admin');
    }
  }

  await db.update(user).set({ role }).where(eq(user.id, targetUserId));
  revalidatePath('/app/admin');
  return { ok: true, role, self: targetUserId === me.id };
}

// Shared guard for moderation actions. Moderators may act on members only;
// admins may act on members and moderators. No one may ban/delete an admin
// (prevents lockout), and no one may act on themselves.
async function loadModerationTarget(
  targetUserId: string,
  action: 'ban' | 'delete',
) {
  const actorRole = await requireRole(
    action === 'delete' ? 'ADMIN' : 'MODERATOR',
  );
  const me = await getCurrentUser();

  if (targetUserId === me.id) {
    throw new Error(`You cannot ${action} your own account`);
  }

  const [target] = await db
    .select({ id: user.id, name: user.name, role: user.role })
    .from(user)
    .where(eq(user.id, targetUserId))
    .limit(1);
  if (!target) throw new Error('User not found');

  const targetRole = normalizeRole(target.role);
  if (targetRole === 'ADMIN') {
    throw new Error('Admins cannot be banned or deleted');
  }
  if (actorRole !== 'ADMIN' && targetRole !== 'MEMBER') {
    throw new Error('Moderators can only moderate members');
  }

  return { me, target, targetRole };
}

// Ban a user's account, optionally also banning the IP from their most recent
// session. durationDays = null means a permanent ban. Moderators+ only.
export async function banUser(
  targetUserId: string,
  opts: { reason: string; durationDays: number | null; banIp?: boolean },
) {
  const { me } = await loadModerationTarget(targetUserId, 'ban');

  const reason = opts.reason.trim();
  if (!reason) throw new Error('A ban reason is required');

  const expiresAt =
    opts.durationDays != null
      ? new Date(Date.now() + opts.durationDays * 24 * 60 * 60 * 1000)
      : null;

  // Lift any currently-active ban so there is only ever one active row.
  await db
    .update(ban)
    .set({
      liftedAt: new Date(),
      liftedById: me.id,
      liftReason: 'Superseded by a new ban',
    })
    .where(and(eq(ban.userId, targetUserId), isNull(ban.liftedAt)));

  // Capture the target's most recent known IP for the record / IP ban.
  const [lastSession] = await db
    .select({ ip: session.ipAddress })
    .from(session)
    .where(
      and(
        eq(session.userId, targetUserId),
        sql`${session.ipAddress} is not null`,
      ),
    )
    .orderBy(desc(session.createdAt))
    .limit(1);
  const capturedIp = lastSession?.ip ?? null;

  await db.insert(ban).values({
    id: newId('ban'),
    userId: targetUserId,
    bannedById: me.id,
    reason,
    expiresAt,
    ipAddress: opts.banIp ? capturedIp : null,
  });

  await db
    .update(user)
    .set({ isBanned: true, banExpiresAt: expiresAt })
    .where(eq(user.id, targetUserId));

  // Optionally ban the captured IP.
  if (opts.banIp && capturedIp) {
    // Lift any prior active ban on the same IP first.
    await db
      .update(bannedIp)
      .set({ liftedAt: new Date(), liftedById: me.id })
      .where(
        and(eq(bannedIp.ipAddress, capturedIp), isNull(bannedIp.liftedAt)),
      );
    await db.insert(bannedIp).values({
      id: newId('ipban'),
      ipAddress: capturedIp,
      reason,
      bannedById: me.id,
      userId: targetUserId,
      expiresAt,
    });
  }

  // Force immediate logout by clearing the target's sessions.
  await db.delete(session).where(eq(session.userId, targetUserId));

  revalidatePath('/app/admin');
  return { ok: true, ipBanned: Boolean(opts.banIp && capturedIp) };
}

// Lift all active bans (account + originating IP bans) for a user. Moderators+ only.
export async function unbanUser(
  targetUserId: string,
  reason = 'no reason provided',
) {
  const actorRole = await requireRole('MODERATOR');
  const me = await getCurrentUser();

  const [target] = await db
    .select({ id: user.id, role: user.role })
    .from(user)
    .where(eq(user.id, targetUserId))
    .limit(1);
  if (!target) throw new Error('User not found');
  if (actorRole !== 'ADMIN' && normalizeRole(target.role) !== 'MEMBER') {
    throw new Error('Moderators can only moderate members');
  }

  await db
    .update(ban)
    .set({ liftedAt: new Date(), liftedById: me.id, liftReason: reason })
    .where(and(eq(ban.userId, targetUserId), isNull(ban.liftedAt)));

  // Also lift IP bans that originated from this account so access is restored.
  await db
    .update(bannedIp)
    .set({ liftedAt: new Date(), liftedById: me.id })
    .where(and(eq(bannedIp.userId, targetUserId), isNull(bannedIp.liftedAt)));

  await db
    .update(user)
    .set({ isBanned: false, banExpiresAt: null })
    .where(eq(user.id, targetUserId));

  revalidatePath('/app/admin');
  return { ok: true };
}

// Lift a single IP ban by id. Moderators+ only.
export async function liftIpBan(
  ipBanId: string,
  reason = 'no reason provided',
) {
  await requireRole('MODERATOR');
  const me = await getCurrentUser();
  await db
    .update(bannedIp)
    .set({ liftedAt: new Date(), liftedById: me.id, liftReason: reason })
    .where(eq(bannedIp.id, ipBanId));
  revalidatePath('/app/admin');
  return { ok: true };
}

// Permanently delete a user and all of their data. Admins only. Session and
// account rows cascade via FK; every other table is cleaned explicitly.
export async function deleteUser(targetUserId: string) {
  await loadModerationTarget(targetUserId, 'delete');

  // Likes on the user's posts (by anyone), then the user's own likes.
  const ownPosts = await db
    .select({ id: post.id })
    .from(post)
    .where(eq(post.userId, targetUserId));
  const ownPostIds = ownPosts.map((p) => p.id);
  if (ownPostIds.length > 0) {
    await db.delete(postLike).where(inArray(postLike.postId, ownPostIds));
  }
  await db.delete(postLike).where(eq(postLike.userId, targetUserId));
  await db.delete(post).where(eq(post.userId, targetUserId));

  await db.delete(interest).where(eq(interest.userId, targetUserId));
  await db
    .delete(invite)
    .where(
      or(
        eq(invite.senderId, targetUserId),
        eq(invite.receiverId, targetUserId),
      ),
    );
  await db.delete(message).where(eq(message.senderId, targetUserId));
  await db
    .delete(chatParticipant)
    .where(eq(chatParticipant.userId, targetUserId));
  await db
    .delete(notification)
    .where(
      or(
        eq(notification.userId, targetUserId),
        eq(notification.actorId, targetUserId),
      ),
    );
  await db.delete(randomQueue).where(eq(randomQueue.userId, targetUserId));
  await db
    .delete(report)
    .where(
      or(
        eq(report.reporterId, targetUserId),
        eq(report.reportedUserId, targetUserId),
      ),
    );

  // Remove this user's ban history (their account is going away).
  await db.delete(ban).where(eq(ban.userId, targetUserId));
  await db.delete(bannedIp).where(eq(bannedIp.userId, targetUserId));

  // Finally the user; session + account cascade on FK.
  await db.delete(user).where(eq(user.id, targetUserId));

  revalidatePath('/app/admin');
  return { ok: true };
}

// Full ban history for a user: account bans + IP bans, newest first. Moderators+ only.
export async function getBanHistory(
  targetUserId: string,
): Promise<BanHistoryEntry[]> {
  await requireRole('MODERATOR');

  // Create two distinct references to the user table
  const bannerAlias = aliasedTable(user, 'banner');
  const lifterAlias = aliasedTable(user, 'lifter');

  const accountRows = await db
    .select({
      id: ban.id,
      reason: ban.reason,
      ipAddress: ban.ipAddress,
      createdAt: ban.createdAt,
      expiresAt: ban.expiresAt,
      liftedAt: ban.liftedAt,
      liftReason: ban.liftReason,
      liftedById: ban.liftedById,
      liftedByName: lifterAlias.name, // Now correctly references lifter
      liftedByAvatar: lifterAlias.image,
      bannedById: ban.bannedById,
      bannedByName: bannerAlias.name, // Now correctly references banner
      bannedByAvatar: bannerAlias.image,
    })
    .from(ban)
    .leftJoin(bannerAlias, eq(bannerAlias.id, ban.bannedById))
    .leftJoin(lifterAlias, eq(lifterAlias.id, ban.liftedById)) // Add second join
    .where(eq(ban.userId, targetUserId))
    .orderBy(desc(ban.createdAt));

  const ipRows = await db
    .select({
      id: bannedIp.id,
      reason: bannedIp.reason,
      ipAddress: bannedIp.ipAddress,
      createdAt: bannedIp.createdAt,
      expiresAt: bannedIp.expiresAt,
      liftedAt: bannedIp.liftedAt,
      liftReason: bannedIp.liftReason,
      liftedById: bannedIp.liftedById,
      liftedByName: lifterAlias.name,
      liftedByAvatar: lifterAlias.image,
      bannedById: bannedIp.bannedById,
      bannedByName: bannerAlias.name,
      bannedByAvatar: bannerAlias.image,
    })
    .from(bannedIp)
    .leftJoin(bannerAlias, eq(bannerAlias.id, bannedIp.bannedById))
    .leftJoin(lifterAlias, eq(lifterAlias.id, bannedIp.liftedById))
    .where(eq(bannedIp.userId, targetUserId))
    .orderBy(desc(bannedIp.createdAt));

  const now = Date.now();
  const account: BanHistoryEntry[] = accountRows.map((r) => ({
    id: r.id,
    scope: 'ACCOUNT',
    reason: r.reason,
    ipAddress: r.ipAddress,
    bannedById: r.bannedById ?? null,
    bannedByName: r.bannedByName ?? null,
    bannedByAvatar: r.bannedByAvatar ?? null,
    createdAt: r.createdAt.toISOString(),
    expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
    liftedAt: r.liftedAt ? r.liftedAt.toISOString() : null,
    liftedById: r.liftedById ?? null,
    liftedByName: r.liftedByName ?? null,
    liftedByAvatar: r.liftedByAvatar ?? null,
    liftReason: r.liftReason ?? null,
    active: !r.liftedAt && (!r.expiresAt || r.expiresAt.getTime() > now),
  }));

  const ip: BanHistoryEntry[] = ipRows.map((r) => ({
    id: r.id,
    scope: 'IP',
    reason: r.reason,
    ipAddress: r.ipAddress,
    bannedById: r.bannedById ?? null,
    bannedByName: r.bannedByName ?? null,
    bannedByAvatar: r.bannedByAvatar ?? null,
    createdAt: r.createdAt.toISOString(),
    expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
    liftedAt: r.liftedAt ? r.liftedAt.toISOString() : null,
    liftedById: r.liftedById ?? null,
    liftedByName: r.liftedByName ?? null,
    liftedByAvatar: r.liftedByAvatar ?? null,
    liftReason: r.liftReason ?? null,
    active: !r.liftedAt && (!r.expiresAt || r.expiresAt.getTime() > now),
  }));

  return [...account, ...ip].sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : -1,
  );
}
