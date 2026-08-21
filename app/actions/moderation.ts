'use server';

import {
  aliasedTable,
  and,
  count,
  desc,
  eq,
  inArray,
  isNull,
  lt,
  ne,
  or,
  sql,
} from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { tombstoneMessage } from '@/app/actions/chat';
import { db } from '@/lib/db';
import {
  ban,
  bannedIp,
  chat,
  chatParticipant,
  interest,
  invite,
  message,
  notification,
  post,
  postHashtag,
  postLike,
  randomQueue,
  report,
  session,
  user,
} from '@/lib/db/schema';
import { generateUsername, newId } from '@/lib/id';
import { MODERATION_USERS_PAGE_SIZE } from '@/lib/pagination';
import { atLeast, normalizeRole, type Role } from '@/lib/roles';
import { requireRole } from '@/lib/roles-server';
import { getCurrentUser } from '@/lib/session';
import { sendSystemDM } from '@/lib/system-messages';
import { SYSTEM_USER_ID } from '@/lib/system-user';

export type ModerationUserRow = {
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

// How many users a single moderation page shows. The dashboard pages through
// the full list rather than loading everyone at once (see
// MODERATION_USERS_PAGE_SIZE).
export type ModerationUserPage = {
  users: ModerationUserRow[];
  total: number;
  page: number;
  pageSize: number;
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

// List users for the moderation panel, optionally filtered by a search query
// and paged (MODERATION_USERS_PAGE_SIZE per page). Returns the page's rows plus
// the total matching count so the UI can render pager controls.
export async function listUsersForModeration(
  query = '',
  page = 1,
): Promise<ModerationUserPage> {
  await requireRole('MODERATOR');
  const me = await getCurrentUser();

  const q = query.trim().toLowerCase();
  // Always hide the built-in System account — it's an automated actor, not a
  // moderatable person.
  const notSystem = ne(user.id, SYSTEM_USER_ID);
  const where = q
    ? and(
        notSystem,
        or(
          sql`lower(${user.name}) like ${'%' + q + '%'}`,
          sql`lower(${user.username}) like ${'%' + q + '%'}`,
          sql`lower(${user.email}) like ${'%' + q + '%'}`,
        ),
      )
    : notSystem;

  const pageSize = MODERATION_USERS_PAGE_SIZE;
  const safePage = Math.max(1, Math.floor(page) || 1);
  const offset = (safePage - 1) * pageSize;

  const [{ value: total }] = await db
    .select({ value: count() })
    .from(user)
    .where(where);

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
    .limit(pageSize)
    .offset(offset);

  return {
    users: rows.map((r) => ({
      id: r.id,
      name: r.name,
      username: r.username,
      email: r.email,
      image: r.image,
      role: normalizeRole(r.role),
      isSelf: r.id === me.id,
      isBanned: r.isBanned,
      banExpiresAt: r.banExpiresAt ? r.banExpiresAt.toISOString() : null,
    })),
    total: Number(total),
    page: safePage,
    pageSize,
  };
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
  revalidatePath('/app/dashboard');
  return { ok: true, role, self: targetUserId === me.id };
}

// Shared guard for moderation actions. Moderators may act on members only;
// admins may act on members and moderators. No one may ban/delete an admin
// (prevents lockout), and no one may act on themselves.
async function loadModerationTarget(
  targetUserId: string,
  action: 'ban' | 'delete' | 'reset',
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
    throw new Error('Admins cannot be moderated');
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

  revalidatePath('/app/dashboard');
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

  revalidatePath('/app/dashboard');
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
  revalidatePath('/app/dashboard');
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
        eq(notification.recipientId, targetUserId),
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

  revalidatePath('/app/dashboard');
  return { ok: true };
}

// Which profile fields a moderator may blank out. `name` and `username` are
// NOT NULL in the schema, so they're reset to safe placeholders rather than
// cleared; `image` and `bio` are nullable and set to null; `interests` clears
// the tag rows; `posts` deletes every post the user has made (and its likes).
export type ResetProfileFields = {
  name?: boolean;
  username?: boolean;
  image?: boolean;
  bio?: boolean;
  interests?: boolean;
  posts?: boolean;
};

// Blank a target user's inappropriate profile content. Moderators may reset
// members; admins may also reset moderators. Admins are never resettable and no
// one may reset themselves (guarded in loadModerationTarget). Returns the new
// name/username so the client can reflect the change without a refetch.
export async function resetUserProfile(
  targetUserId: string,
  fields: ResetProfileFields,
) {
  await loadModerationTarget(targetUserId, 'reset');

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  let newName: string | null = null;
  let newUsername: string | null = null;

  if (fields.name) {
    newName = 'Removed User';
    updates.name = newName;
  }
  if (fields.username) {
    // Generate a fresh placeholder handle and make sure it isn't already taken.
    let candidate = generateUsername();
    for (let i = 0; i < 5; i++) {
      const [taken] = await db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.username, candidate))
        .limit(1);
      if (!taken) break;
      candidate = generateUsername();
    }
    newUsername = candidate;
    updates.username = candidate;
  }
  if (fields.image) updates.image = null;
  if (fields.bio) updates.bio = null;

  // Nothing to do if no fields were selected (interests handled separately).
  const hasColumnUpdates = Object.keys(updates).length > 1;
  if (hasColumnUpdates) {
    await db.update(user).set(updates).where(eq(user.id, targetUserId));
  }

  if (fields.interests) {
    await db.delete(interest).where(eq(interest.userId, targetUserId));
  }

  // Soft-delete every post they've made. Mirrors moderatorDeletePost: the rows
  // (and their likes) are retained for 30 days for moderation, then purged.
  let postsDeleted = 0;
  if (fields.posts) {
    const ownPosts = await db
      .select({ id: post.id })
      .from(post)
      .where(and(eq(post.userId, targetUserId), isNull(post.deletedAt)));
    const ownPostIds = ownPosts.map((p) => p.id);
    if (ownPostIds.length > 0) {
      await db
        .update(post)
        .set({ deletedAt: new Date() })
        .where(inArray(post.id, ownPostIds));
      revalidatePath('/app/feed');
    }
    postsDeleted = ownPostIds.length;
  }

  revalidatePath('/app/dashboard');
  revalidatePath('/app/u/[username]', 'page');

  // Let the user know their profile was moderated (via the System account,
  // which also raises the normal message notification).
  void sendSystemDM(
    targetUserId,
    { kind: 'PROFILE_RESET' },
    'A moderator reset parts of your profile for violating our community guidelines.',
  );

  return { ok: true, name: newName, username: newUsername, postsDeleted };
}

// Delete any user's post as a moderator. You can remove posts from users at or
// below your own role: moderators cover members + moderators, admins cover
// everyone (including other admins). A moderator can never delete an admin's
// post. Owners delete their own posts through the normal deletePost action.
export async function moderatorDeletePost(postId: string) {
  const actorRole = await requireRole('MODERATOR');
  const me = await getCurrentUser();

  const [row] = await db
    .select({ authorId: post.userId, authorRole: user.role })
    .from(post)
    .innerJoin(user, eq(user.id, post.userId))
    .where(and(eq(post.id, postId), isNull(post.deletedAt)))
    .limit(1);
  if (!row) throw new Error('Post not found');

  // Own posts are always removable here; otherwise the author must not outrank
  // the actor. The only rank above a moderator is admin, so this reads as
  // "moderators can't delete an admin's post".
  if (
    row.authorId !== me.id &&
    !atLeast(actorRole, normalizeRole(row.authorRole))
  ) {
    throw new Error("Only an admin can delete an admin's post");
  }

  // Soft-delete: hide the post but retain the row (and its likes/hashtags) for
  // 30 days so a report against it stays verifiable. A background purge
  // (purgeExpiredContent) hard-removes it past the window.
  await db
    .update(post)
    .set({ deletedAt: new Date() })
    .where(eq(post.id, postId));

  // Notify the author their post was removed (unless a moderator removed their
  // own post). Fires via the System account, which also raises the normal
  // message notification.
  if (row.authorId !== me.id) {
    void sendSystemDM(
      row.authorId,
      { kind: 'POST_REMOVED' },
      'A moderator removed one of your posts for violating our community guidelines.',
    );
  }

  revalidatePath('/app/feed');
  revalidatePath('/app/u/[username]', 'page');
  return { ok: true };
}

// Delete any user's chat message as a moderator, mirroring moderatorDeletePost's
// rank rules: you can remove messages from users at or below your own role, and
// a moderator can never delete an admin's message. The message is soft-deleted
// (content retained for the 30-day window) and the tombstone is broadcast so it
// vanishes from open clients. Returns the message's chatId for the caller.
export async function moderatorDeleteMessage(messageId: string) {
  const actorRole = await requireRole('MODERATOR');
  const me = await getCurrentUser();

  const [row] = await db
    .select({
      chatId: message.chatId,
      authorId: message.senderId,
      authorRole: user.role,
      deletedAt: message.deletedAt,
    })
    .from(message)
    .innerJoin(user, eq(user.id, message.senderId))
    .where(eq(message.id, messageId))
    .limit(1);
  if (!row) throw new Error('Message not found');

  // Own messages are always removable here; otherwise the author must not
  // outrank the actor ("moderators can't delete an admin's message").
  if (
    row.authorId !== me.id &&
    !atLeast(actorRole, normalizeRole(row.authorRole))
  ) {
    throw new Error("Only an admin can delete an admin's message");
  }

  // Soft-delete + broadcast the masked tombstone via the chat presenter.
  await tombstoneMessage(row.chatId, messageId);

  // Notify the author their message was removed (unless it was their own).
  if (row.authorId !== me.id) {
    void sendSystemDM(
      row.authorId,
      { kind: 'MESSAGE_REMOVED' },
      'A moderator removed one of your messages for violating our community guidelines.',
    );
  }

  return { ok: true, chatId: row.chatId };
}

// How long removed content is retained for moderation before it's hard-purged.
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

// Hard-remove content that has been soft-deleted longer than the 30-day
// retention window. Admin-only. This is the back half of the retention policy:
// deletePost / moderatorDeletePost / deleteMessage / removeFriend only stamp a
// tombstone; this permanently erases anything past the cutoff. Safe to run
// repeatedly (e.g. from a cron) — it only ever touches already-expired rows.
export async function purgeExpiredContent() {
  await requireRole('ADMIN');
  const cutoff = new Date(Date.now() - RETENTION_MS);

  // --- Posts past the window: drop the post + its likes + its hashtags. ---
  const expiredPosts = await db
    .select({ id: post.id })
    .from(post)
    .where(and(sql`${post.deletedAt} is not null`, lt(post.deletedAt, cutoff)));
  const expiredPostIds = expiredPosts.map((p) => p.id);
  if (expiredPostIds.length > 0) {
    await db.delete(postLike).where(inArray(postLike.postId, expiredPostIds));
    await db
      .delete(postHashtag)
      .where(inArray(postHashtag.postId, expiredPostIds));
    await db.delete(post).where(inArray(post.id, expiredPostIds));
  }

  // --- Whole chats past the window (set when two people unfriend): drop every
  // message, participant row, and notification tied to the chat, then the chat. ---
  const expiredChats = await db
    .select({ id: chat.id })
    .from(chat)
    .where(and(sql`${chat.deletedAt} is not null`, lt(chat.deletedAt, cutoff)));
  const expiredChatIds = expiredChats.map((c) => c.id);
  if (expiredChatIds.length > 0) {
    await db.delete(message).where(inArray(message.chatId, expiredChatIds));
    await db
      .delete(chatParticipant)
      .where(inArray(chatParticipant.chatId, expiredChatIds));
    await db
      .delete(notification)
      .where(inArray(notification.targetId, expiredChatIds));
    await db.delete(chat).where(inArray(chat.id, expiredChatIds));
  }

  // --- Individual soft-deleted messages in still-live chats: the row stays
  // (ordering/replies depend on it) but its retained content is finally erased.
  // Messages in the chats purged above are already gone, so this only reaches
  // tombstoned messages whose chat is still active. ---
  await db
    .update(message)
    .set({ content: null, imageUrl: null })
    .where(
      and(
        sql`${message.deletedAt} is not null`,
        lt(message.deletedAt, cutoff),
      ),
    );

  return {
    ok: true,
    postsPurged: expiredPostIds.length,
    chatsPurged: expiredChatIds.length,
  };
}
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

export async function deleteBanHistoryEntry(
  entryID: string,
  scope: 'ACCOUNT' | 'IP',
) {
  await requireRole('ADMIN');

  if (scope === 'IP') {
    await db.delete(bannedIp).where(eq(bannedIp.id, entryID));
  } else {
    await db.delete(ban).where(eq(ban.id, entryID));
  }

  revalidatePath('/app/dashboard');
  return { ok: true };
}
