'use server';

import { db } from '@/lib/db';
import { user, post, invite, interest } from '@/lib/db/schema';
import { getCurrentUser, getUserId } from '@/lib/session';
import { newId } from '@/lib/id';
import type { UserProfile } from '@/lib/types';
import { and, eq, or, sql, ne, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

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
  const [{ c: postCount }] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(post)
    .where(eq(post.userId, u.id));

  const rel = await relationship(viewerId, u.id);
  const fc = await friendCount(u.id);
  const interests = await getInterests(u.id);

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
    isSelf: u.id === viewerId,
    friendStatus: rel.friendStatus,
    dmChatId: rel.dmChatId,
  };
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
  const [u] = await db.select().from(user).where(eq(user.id, me.id)).limit(1);
  if (!u) return null;
  const interests = await getInterests(u.id);
  return {
    id: u.id,
    name: u.name,
    username: u.username,
    image: u.image,
    bio: u.bio,
    interests,
  };
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

  if (input.name !== undefined) {
    const n = input.name.trim();
    if (n.length < 1 || n.length > 50)
      throw new Error('Display name must be 1–50 characters');
    updates.name = n;
  }

  if (input.username !== undefined) {
    const uname = normalizeUsername(input.username);
    if (!USERNAME_RE.test(uname)) {
      throw new Error(
        'Username must be 3–20 characters: letters, numbers, underscores',
      );
    }
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
    updates.bio = b || null;
  }

  if (input.image !== undefined) {
    updates.image = input.image;
  }

  await db.update(user).set(updates).where(eq(user.id, userId));
  revalidatePath('/app/settings');
  revalidatePath('/app');
  return { ok: true };
}

// Directory search by username, display name, or interest tag (for the "add
// friend" search). A leading '#' forces an interest-only search.
export async function searchUsers(query: string) {
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

  // Fetch interests for the matched users in one query.
  const resultIds = rows.map((r) => r.id);
  const interestRows = resultIds.length
    ? await db
        .select({ userId: interest.userId, tag: interest.tag })
        .from(interest)
        .where(inArray(interest.userId, resultIds))
    : [];
  const interestsByUser = new Map<string, string[]>();
  for (const r of interestRows) {
    const arr = interestsByUser.get(r.userId) ?? [];
    arr.push(r.tag);
    interestsByUser.set(r.userId, arr);
  }

  // Annotate each result with the viewer's relationship so the UI can show the
  // right action (Add / Requested / Respond / Friends).
  const rels = await db
    .select({
      senderId: invite.senderId,
      receiverId: invite.receiverId,
      status: invite.status,
    })
    .from(invite)
    .where(or(eq(invite.senderId, me.id), eq(invite.receiverId, me.id)));

  function statusFor(
    otherId: string,
  ): 'none' | 'friends' | 'incoming' | 'outgoing' {
    for (const r of rels) {
      const involves =
        (r.senderId === me.id && r.receiverId === otherId) ||
        (r.senderId === otherId && r.receiverId === me.id);
      if (!involves) continue;
      if (r.status === 'ACCEPTED') return 'friends';
      if (r.status === 'PENDING')
        return r.senderId === me.id ? 'outgoing' : 'incoming';
    }
    return 'none';
  }

  return rows.map((r) => ({
    ...r,
    friendStatus: statusFor(r.id),
    interests: (interestsByUser.get(r.id) ?? []).slice(0, 5),
  }));
}
