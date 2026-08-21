'use server';

import { and, eq, inArray, isNull, ne, or, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { db } from '@/lib/db';
import { interest, invite, post, user } from '@/lib/db/schema';
import { newId } from '@/lib/id';
import { notifyMentions } from '@/lib/mentions-notify';
import { isReservedName } from '@/lib/reserved-names';
import { getCurrentUser, getUserId } from '@/lib/session';
import type { MentionSuggestion, UserProfile } from '@/lib/types';

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
const MAX_INTERESTS = 10;

function normalizeUsername(u: string) {
  return u.trim().toLowerCase();
}

// Normalize an interest tag: lowercase, trim, collapse whitespace to single
// spaces, strip leading '#'. Returns "" if nothing usable remains.
function normalizeTag(raw: string) {
  return raw
    .trim()
    .replace(/^#+/, '')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .slice(0, 30);
}

async function getInterests(userId: string): Promise<string[]> {
  const rows = await db
    .select({ tag: interest.tag })
    .from(interest)
    .where(eq(interest.userId, userId))
    .orderBy(interest.tag);
  return rows.map((r) => r.tag);
}

// Count accepted friendships involving a user.
async function friendCount(userId: string) {
  const [row] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(invite)
    .where(
      and(
        eq(invite.status, 'ACCEPTED'),
        or(eq(invite.senderId, userId), eq(invite.receiverId, userId)),
      ),
    );
  return row?.c ?? 0;
}

// Resolve the relationship between the viewer and a target user.
async function relationship(viewerId: string, targetId: string) {
  if (viewerId === targetId) {
    return { friendStatus: 'none' as const, dmChatId: null };
  }
  const rows = await db
    .select()
    .from(invite)
    .where(
      or(
        and(eq(invite.senderId, viewerId), eq(invite.receiverId, targetId)),
        and(eq(invite.senderId, targetId), eq(invite.receiverId, viewerId)),
      ),
    );
  let friendStatus: UserProfile['friendStatus'] = 'none';
  let dmChatId: string | null = null;
  for (const r of rows) {
    if (r.status === 'ACCEPTED') {
      friendStatus = 'friends';
      if (r.chatId) dmChatId = r.chatId;
    } else if (r.status === 'PENDING') {
      friendStatus = r.senderId === viewerId ? 'outgoing' : 'incoming';
    }
  }
  return { friendStatus, dmChatId };
}

// Build the full profile payload for a resolved user row, from the viewer's POV.
async function buildProfile(
  viewerId: string,
  u: typeof user.$inferSelect,
): Promise<UserProfile> {
  // Independent per-profile aggregates — fetch them concurrently.
  const [postRows, rel, fc, interests] = await Promise.all([
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(post)
      .where(and(eq(post.userId, u.id), isNull(post.deletedAt))),
    relationship(viewerId, u.id),
    friendCount(u.id),
    getInterests(u.id),
  ]);
  const postCount = postRows[0]?.c ?? 0;
  const isSelf = u.id === viewerId;
  const postsVisible =
    isSelf || !u.friendsOnlyPosts || rel.friendStatus === 'friends';

  return {
    id: u.id,
    name: u.name,
    username: u.username,
    image: u.image,
    bio: u.bio,
    interests,
    role: u.role === 'ADMIN' || u.role === 'MODERATOR' ? u.role : 'MEMBER',
    postCount,
    friendCount: fc,
    createdAt: u.createdAt.toISOString(),
    isSelf,
    friendStatus: rel.friendStatus,
    dmChatId: rel.dmChatId,
    friendsOnlyPosts: u.friendsOnlyPosts,
    postsVisible,
  };
}

// Batched buildProfile for many users from the viewer's POV: resolves every
// user's post count, friend count, relationship, and interests in a fixed set
// of grouped queries instead of one buildProfile (5 queries) per user.
async function buildProfilesFor(
  viewerId: string,
  users: (typeof user.$inferSelect)[],
): Promise<UserProfile[]> {
  if (users.length === 0) return [];
  const ids = users.map((u) => u.id);
  const idSet = new Set(ids);

  const [postCountRows, interestRows, friendRows, relRows] = await Promise.all([
    db
      .select({ userId: post.userId, c: sql<number>`count(*)::int` })
      .from(post)
      .where(and(inArray(post.userId, ids), isNull(post.deletedAt)))
      .groupBy(post.userId),
    db
      .select({ userId: interest.userId, tag: interest.tag })
      .from(interest)
      .where(inArray(interest.userId, ids))
      .orderBy(interest.tag),
    db
      .select({ senderId: invite.senderId, receiverId: invite.receiverId })
      .from(invite)
      .where(
        and(
          eq(invite.status, 'ACCEPTED'),
          or(inArray(invite.senderId, ids), inArray(invite.receiverId, ids)),
        ),
      ),
    db
      .select({
        senderId: invite.senderId,
        receiverId: invite.receiverId,
        status: invite.status,
        chatId: invite.chatId,
      })
      .from(invite)
      .where(
        or(
          and(eq(invite.senderId, viewerId), inArray(invite.receiverId, ids)),
          and(eq(invite.receiverId, viewerId), inArray(invite.senderId, ids)),
        ),
      ),
  ]);

  const postCountByUser = new Map<string, number>();
  for (const r of postCountRows) postCountByUser.set(r.userId, r.c);

  const interestsByUser = new Map<string, string[]>();
  for (const r of interestRows) {
    const arr = interestsByUser.get(r.userId) ?? [];
    arr.push(r.tag);
    interestsByUser.set(r.userId, arr);
  }

  // count(*) for each user across the accepted rows they appear in (as either
  // sender or receiver); two search results who are friends count each other.
  const friendCountByUser = new Map<string, number>();
  for (const r of friendRows) {
    if (idSet.has(r.senderId))
      friendCountByUser.set(
        r.senderId,
        (friendCountByUser.get(r.senderId) ?? 0) + 1,
      );
    if (idSet.has(r.receiverId))
      friendCountByUser.set(
        r.receiverId,
        (friendCountByUser.get(r.receiverId) ?? 0) + 1,
      );
  }

  const relByUser = new Map<
    string,
    { friendStatus: UserProfile['friendStatus']; dmChatId: string | null }
  >();
  for (const r of relRows) {
    const targetId = r.senderId === viewerId ? r.receiverId : r.senderId;
    const cur = relByUser.get(targetId) ?? {
      friendStatus: 'none' as UserProfile['friendStatus'],
      dmChatId: null,
    };
    if (r.status === 'ACCEPTED') {
      cur.friendStatus = 'friends';
      if (r.chatId) cur.dmChatId = r.chatId;
    } else if (r.status === 'PENDING') {
      cur.friendStatus = r.senderId === viewerId ? 'outgoing' : 'incoming';
    }
    relByUser.set(targetId, cur);
  }

  return users.map((u) => {
    const rel = relByUser.get(u.id) ?? {
      friendStatus: 'none' as UserProfile['friendStatus'],
      dmChatId: null,
    };
    const isSelf = u.id === viewerId;
    const postsVisible =
      isSelf || !u.friendsOnlyPosts || rel.friendStatus === 'friends';
    return {
      id: u.id,
      name: u.name,
      username: u.username,
      image: u.image,
      bio: u.bio,
      interests: interestsByUser.get(u.id) ?? [],
      role: u.role === 'ADMIN' || u.role === 'MODERATOR' ? u.role : 'MEMBER',
      postCount: postCountByUser.get(u.id) ?? 0,
      friendCount: friendCountByUser.get(u.id) ?? 0,
      createdAt: u.createdAt.toISOString(),
      isSelf,
      friendStatus: rel.friendStatus,
      dmChatId: rel.dmChatId,
      friendsOnlyPosts: u.friendsOnlyPosts,
      postsVisible,
    };
  });
}

export async function getProfileByUsername(
  username: string,
): Promise<UserProfile | null> {
  const viewer = await getCurrentUser();
  const uname = normalizeUsername(username);
  const [u] = await db
    .select()
    .from(user)
    .where(sql`lower(${user.username}) = ${uname}`)
    .limit(1);
  if (!u) return null;
  return buildProfile(viewer.id, u);
}

// Lightweight profile lookup by id, used by the in-chat profile preview popup.
export async function getProfilePreview(
  userId: string,
): Promise<UserProfile | null> {
  const viewer = await getCurrentUser();
  const [u] = await db.select().from(user).where(eq(user.id, userId)).limit(1);
  if (!u) return null;
  return buildProfile(viewer.id, u);
}

export async function getMyProfile() {
  const me = await getCurrentUser();
  const [[u], interests] = await Promise.all([
    db.select().from(user).where(eq(user.id, me.id)).limit(1),
    getInterests(me.id),
  ]);
  if (!u) return null;
  return {
    id: u.id,
    name: u.name,
    username: u.username,
    image: u.image,
    bio: u.bio,
    interests,
    friendsOnlyPosts: u.friendsOnlyPosts,
  };
}

// Toggle the "only friends can see your posts" privacy setting.
export async function updatePostsVisibility(friendsOnly: boolean) {
  const userId = await getUserId();
  await db
    .update(user)
    .set({ friendsOnlyPosts: friendsOnly, updatedAt: new Date() })
    .where(eq(user.id, userId));
  revalidatePath('/app/settings');
  revalidatePath('/app');
  return { friendsOnlyPosts: friendsOnly };
}

// Replace the current user's interest tags with a new set (deduped, capped).
export async function updateInterests(tags: string[]) {
  const userId = await getUserId();
  const cleaned: string[] = [];
  for (const raw of tags) {
    const t = normalizeTag(raw);
    if (t && !cleaned.includes(t)) cleaned.push(t);
    if (cleaned.length >= MAX_INTERESTS) break;
  }

  // Diff against existing so we only insert/delete what changed.
  const existing = await getInterests(userId);
  const toAdd = cleaned.filter((t) => !existing.includes(t));
  const toRemove = existing.filter((t) => !cleaned.includes(t));

  if (toRemove.length) {
    await db
      .delete(interest)
      .where(and(eq(interest.userId, userId), inArray(interest.tag, toRemove)));
  }
  for (const tag of toAdd) {
    await db
      .insert(interest)
      .values({ id: newId('int'), userId, tag })
      .onConflictDoNothing({ target: [interest.userId, interest.tag] });
  }

  revalidatePath('/app/settings');
  return { interests: cleaned };
}

export async function isUsernameAvailable(username: string) {
  const uname = normalizeUsername(username);
  if (!USERNAME_RE.test(uname)) {
    return { available: false, reason: 'invalid' as const };
  }
  if (isReservedName(uname)) {
    return { available: false, reason: 'reserved' as const };
  }
  const me = await getCurrentUser();
  const [existing] = await db
    .select({ id: user.id })
    .from(user)
    .where(and(sql`lower(${user.username}) = ${uname}`, ne(user.id, me.id)))
    .limit(1);
  return { available: !existing, reason: existing ? ('taken' as const) : null };
}

export async function updateProfile(input: {
  name?: string;
  username?: string;
  bio?: string;
  image?: string | null;
}) {
  const userId = await getUserId();
  const updates: Record<string, unknown> = { updatedAt: new Date() };

  // When the bio changes, capture the previous value so we only notify handles
  // this edit newly adds. Null until we know a bio update is happening.
  let bioChanged = false;
  let previousBio: string | null = null;
  let nextBio: string | null = null;

  if (input.name !== undefined) {
    const n = input.name.trim();
    if (n.length < 1 || n.length > 50)
      throw new Error('Display name must be 1–50 characters');
    if (isReservedName(n))
      throw new Error(
        "That display name isn't allowed — it impersonates Orbit or our staff",
      );
    updates.name = n;
  }

  if (input.username !== undefined) {
    const uname = normalizeUsername(input.username);
    if (!USERNAME_RE.test(uname)) {
      throw new Error(
        'Username must be 3–20 characters: letters, numbers, underscores',
      );
    }
    if (isReservedName(uname))
      throw new Error(
        "That username isn't allowed — it impersonates Orbit or our staff",
      );
    const [taken] = await db
      .select({ id: user.id })
      .from(user)
      .where(and(sql`lower(${user.username}) = ${uname}`, ne(user.id, userId)))
      .limit(1);
    if (taken) throw new Error('That username is taken');
    updates.username = uname;
  }

  if (input.bio !== undefined) {
    const b = input.bio.trim();
    if (b.length > 300) throw new Error('Bio must be 300 characters or fewer');
    nextBio = b || null;
    updates.bio = nextBio;
    const [cur] = await db
      .select({ bio: user.bio })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    previousBio = cur?.bio ?? null;
    bioChanged = true;
  }

  if (input.image !== undefined) {
    updates.image = input.image;
  }

  await db.update(user).set(updates).where(eq(user.id, userId));
  // Tell anyone newly @tagged in the bio that they were mentioned.
  if (bioChanged) {
    await notifyMentions({
      actorId: userId,
      source: 'profile',
      targetId: userId,
      text: nextBio,
      previousText: previousBio,
    });
  }
  revalidatePath('/app/settings');
  revalidatePath('/app');
  return { ok: true };
}

export async function searchUsers(query: string): Promise<UserProfile[]> {
  const me = await getCurrentUser();
  const raw = query.trim();
  if (raw.length < 2) return [];

  const tagOnly = raw.startsWith('#');
  const q = raw.replace(/^#+/, '').trim().toLowerCase();
  if (q.length < 2) return [];
  const like = `%${q}%`;

  // Ids of users whose interest tags match the query.
  const tagMatches = await db
    .select({ userId: interest.userId })
    .from(interest)
    .where(sql`${interest.tag} like ${like}`)
    .limit(50);
  const tagUserIds = Array.from(
    new Set(tagMatches.map((r) => r.userId)),
  ).filter((id) => id !== me.id);

  const nameMatch = or(
    sql`lower(${user.username}) like ${like}`,
    sql`lower(${user.name}) like ${like}`,
  );

  const rows = await db
    .select()
    .from(user)
    .where(
      and(
        ne(user.id, me.id),
        tagOnly
          ? tagUserIds.length
            ? inArray(user.id, tagUserIds)
            : sql`false`
          : tagUserIds.length
            ? or(nameMatch, inArray(user.id, tagUserIds))
            : nameMatch,
      ),
    )
    .limit(10);

  if (rows.length === 0) return [];

  return buildProfilesFor(me.id, rows);
}

// Lightweight autocomplete for @mentions. Matches username or display name by
// substring, excludes the caller (you can't @-tag yourself), and surfaces
// prefix matches first so typing "@ni" ranks "nikki" above "…ni…". Returns just
// the fields a suggestion row needs — no per-user profile aggregation, so it
// stays cheap enough to call on every keystroke.
export async function searchMentionUsers(
  query: string,
): Promise<MentionSuggestion[]> {
  const me = await getCurrentUser();
  const q = query.trim().toLowerCase();
  if (q.length < 1) return [];

  const like = `%${q}%`;
  const prefix = `${q}%`;

  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      username: user.username,
      image: user.image,
    })
    .from(user)
    .where(
      and(
        ne(user.id, me.id),
        or(
          sql`lower(${user.username}) like ${like}`,
          sql`lower(${user.name}) like ${like}`,
        ),
      ),
    )
    // Prefix matches on the username first, then alphabetical for stability.
    .orderBy(
      sql`case when lower(${user.username}) like ${prefix} then 0 else 1 end`,
      user.username,
    )
    .limit(6);

  return rows;
}
