'use server';

import { and, desc, eq, ilike, inArray, isNull, notInArray, or, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { notify } from '@/app/actions/notifications';

import { db } from '@/lib/db';
import { invite, post, postHashtag, postLike, user } from '@/lib/db/schema';
import { newId } from '@/lib/id';
import { extractHashtags, normalizeHashtag } from '@/lib/mentions';
import { notifyMentions } from '@/lib/mentions-notify';
import { FEED_LIMIT } from '@/lib/pagination';
import { getCurrentUser, getUserId } from '@/lib/session';
import type { FeedScope, PostLiker, PostSummary } from '@/lib/types';

// Ids of a user's accepted friends.
async function friendIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ senderId: invite.senderId, receiverId: invite.receiverId })
    .from(invite)
    .where(
      and(
        eq(invite.status, 'ACCEPTED'),
        or(eq(invite.senderId, userId), eq(invite.receiverId, userId)),
      ),
    );
  const ids = new Set<string>();
  for (const r of rows) {
    ids.add(r.senderId === userId ? r.receiverId : r.senderId);
  }
  return [...ids];
}

// Map post rows + like aggregates into PostSummary[].
async function decoratePosts(
  rows: {
    id: string;
    userId: string;
    imageUrl: string | null;
    caption: string | null;
    createdAt: Date;
    authorName: string;
    authorUsername: string;
    authorImage: string | null;
  }[],
  viewerId: string,
): Promise<PostSummary[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  const likeCounts = await db
    .select({ postId: postLike.postId, c: sql<number>`count(*)::int` })
    .from(postLike)
    .where(inArray(postLike.postId, ids))
    .groupBy(postLike.postId);
  const countMap = new Map(likeCounts.map((l) => [l.postId, l.c]));

  const myLikes = await db
    .select({ postId: postLike.postId })
    .from(postLike)
    .where(and(inArray(postLike.postId, ids), eq(postLike.userId, viewerId)));
  const likedSet = new Set(myLikes.map((l) => l.postId));

  return rows.map((r) => ({
    id: r.id,
    authorId: r.userId,
    authorName: r.authorName,
    authorUsername: r.authorUsername,
    authorImage: r.authorImage,
    imageUrl: r.imageUrl,
    caption: r.caption,
    createdAt: r.createdAt.toISOString(),
    likeCount: countMap.get(r.id) ?? 0,
    likedByMe: likedSet.has(r.id),
    canManage: r.userId === viewerId,
  }));
}

// Rebuild a post's hashtag rows from its (new) caption. Clears the existing set
// and re-inserts the distinct tags, so it's safe to call on both create and
// edit. Best-effort: a hashtag-index hiccup must never fail the post save
// itself, so failures are swallowed (the caption is still the source of truth).
async function syncPostHashtags(postId: string, caption: string | null) {
  try {
    const tags = extractHashtags(caption);
    await db.delete(postHashtag).where(eq(postHashtag.postId, postId));
    if (tags.length === 0) return;
    await db
      .insert(postHashtag)
      .values(tags.map((tag) => ({ id: newId('ptag'), postId, tag })))
      .onConflictDoNothing();
  } catch (err) {
    console.log(
      '[v0] syncPostHashtags failed:',
      err instanceof Error ? err.message : err,
    );
  }
}

export async function createPost(input: {
  imageUrl?: string | null;
  caption?: string;
}) {
  const userId = await getUserId();
  const imageUrl = input.imageUrl?.trim() || null;
  const caption = input.caption?.trim() || null;
  if (caption && caption.length > 500) throw new Error('Caption too long');
  // A post needs at least an image or some text.
  if (!imageUrl && !caption) throw new Error('Add a photo or write something');

  const id = newId('post');
  await db.insert(post).values({ id, userId, imageUrl, caption });
  // Index any #hashtags in the caption so they're searchable and counted.
  await syncPostHashtags(id, caption);
  // Tell anyone @tagged in the caption that they were mentioned.
  await notifyMentions({
    actorId: userId,
    source: 'post',
    targetId: id,
    text: caption,
  });
  revalidatePath('/app/feed');
  revalidatePath('/app/settings/[tab]', 'page');
  return { id };
}

export async function deletePost(postId: string) {
  const userId = await getUserId();
  // Scope the delete to the owner (and a still-live post) so no one can delete
  // another user's post or re-delete an already-removed one.
  const [owned] = await db
    .select({ id: post.id })
    .from(post)
    .where(
      and(eq(post.id, postId), eq(post.userId, userId), isNull(post.deletedAt)),
    )
    .limit(1);
  if (!owned) throw new Error('You can only delete your own posts');

  // Soft-delete: stamp a tombstone and hide the post everywhere, but keep the
  // row (and its likes/hashtags) for 30 days so a report against it can still
  // be verified. A background purge hard-removes it past the window.
  await db
    .update(post)
    .set({ deletedAt: new Date() })
    .where(and(eq(post.id, postId), eq(post.userId, userId)));
  revalidatePath('/app/feed');
  revalidatePath('/app/settings/[tab]', 'page');
  return { ok: true };
}

// Edit a post's caption. Owner-only; returns the normalized caption.
export async function updatePost(postId: string, caption: string) {
  const userId = await getUserId();
  const next = caption.trim();
  if (next.length > 500) throw new Error('Caption too long');

  const [owned] = await db
    .select({ id: post.id, caption: post.caption })
    .from(post)
    .where(
      and(eq(post.id, postId), eq(post.userId, userId), isNull(post.deletedAt)),
    )
    .limit(1);
  if (!owned) throw new Error('You can only edit your own posts');

  await db
    .update(post)
    .set({ caption: next || null })
    .where(and(eq(post.id, postId), eq(post.userId, userId)));
  // Notify only handles that are newly added by this edit, so re-saving a
  // caption that already tagged someone doesn't spam them again.
  await notifyMentions({
    actorId: userId,
    source: 'post',
    targetId: postId,
    text: next || null,
    previousText: owned.caption,
  });
  revalidatePath('/app/feed');
  revalidatePath('/app/settings/[tab]', 'page');
  return { caption: next || null };
}

export async function getUserPosts(
  profileUserId: string,
): Promise<PostSummary[]> {
  const viewer = await getCurrentUser();

  // Enforce the friends-only-posts privacy setting server-side too, so the
  // data is never sent to a viewer who shouldn't see it, regardless of what
  // the UI does with it.
  if (viewer.id !== profileUserId) {
    const [owner] = await db
      .select({ friendsOnlyPosts: user.friendsOnlyPosts })
      .from(user)
      .where(eq(user.id, profileUserId))
      .limit(1);
    if (owner?.friendsOnlyPosts) {
      const friends = await friendIds(profileUserId);
      if (!friends.includes(viewer.id)) return [];
    }
  }

  const rows = await db
    .select({
      id: post.id,
      userId: post.userId,
      imageUrl: post.imageUrl,
      caption: post.caption,
      createdAt: post.createdAt,
      authorName: user.name,
      authorUsername: user.username,
      authorImage: user.image,
    })
    .from(post)
    .innerJoin(user, eq(user.id, post.userId))
    .where(and(eq(post.userId, profileUserId), isNull(post.deletedAt)))
    .orderBy(desc(post.createdAt));
  return decoratePosts(rows, viewer.id);
}

// Columns every feed/profile post query selects, so decoratePosts gets a
// consistent row shape.
const postSelection = {
  id: post.id,
  userId: post.userId,
  imageUrl: post.imageUrl,
  caption: post.caption,
  createdAt: post.createdAt,
  authorName: user.name,
  authorUsername: user.username,
  authorImage: user.image,
};

export async function getFeed(
  scope: FeedScope = 'for-you',
): Promise<PostSummary[]> {
  const viewer = await getCurrentUser();
  const friends = await friendIds(viewer.id);
  // Own posts + accepted friends' posts.
  const authorIds = [viewer.id, ...friends];

  // Own + friends' posts, newest-first. This is the entire "Friends" tab and
  // the top block of the "For You" tab.
  const friendsRows = await db
    .select(postSelection)
    .from(post)
    .innerJoin(user, eq(user.id, post.userId))
    .where(and(inArray(post.userId, authorIds), isNull(post.deletedAt)))
    .orderBy(desc(post.createdAt))
    .limit(FEED_LIMIT);

  if (scope === 'friends') {
    return decoratePosts(friendsRows, viewer.id);
  }

  // "For You": everyone else's posts underneath, newest-first — but never
  // posts from a non-friend who restricts their posts to friends only.
  const othersRows = await db
    .select(postSelection)
    .from(post)
    .innerJoin(user, eq(user.id, post.userId))
    .where(
      and(
        notInArray(post.userId, authorIds),
        eq(user.friendsOnlyPosts, false),
        isNull(post.deletedAt),
      ),
    )
    .orderBy(desc(post.createdAt))
    .limit(FEED_LIMIT);

  // Friends first, then everyone else by recency. The two sets are disjoint
  // (authorIds vs. its complement), so no dedup is needed and decoratePosts
  // preserves this order.
  const combined = [...friendsRows, ...othersRows].slice(0, FEED_LIMIT);
  return decoratePosts(combined, viewer.id);
}

// Escape the LIKE/ILIKE wildcards so a caption search for literal "%" or "_"
// matches those characters instead of treating them as pattern metacharacters.
// Backslash is Postgres' default ILIKE escape char.
function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

// Search posts by caption text and/or hashtags, for the feed's search bar.
// Always global but privacy-respected: a friends-only author's posts are hidden
// from non-friends, exactly like getFeed's "For You" scope. Text is a
// case-insensitive substring match on the caption; tags match if the post
// carries ANY of them (OR). With both, results must match the text AND carry a
// matching tag. Newest-first, capped at FEED_LIMIT.
export async function searchPosts(input: {
  query?: string;
  tags?: string[];
}): Promise<PostSummary[]> {
  const viewer = await getCurrentUser();

  const q = (input.query ?? '').trim();
  // Normalize tags the same way they're stored, dropping anything that isn't a
  // real tag, and dedupe.
  const tags = [
    ...new Set((input.tags ?? []).map(normalizeHashtag).filter(Boolean)),
  ];
  if (!q && tags.length === 0) return [];

  // Tag pre-filter (OR): resolve the tag set to the distinct posts carrying any
  // of them, so the main query stays a simple id membership test rather than a
  // row-multiplying join. No matches → nothing to show.
  let taggedIds: string[] | null = null;
  if (tags.length > 0) {
    const tagRows = await db
      .selectDistinct({ postId: postHashtag.postId })
      .from(postHashtag)
      .where(inArray(postHashtag.tag, tags));
    taggedIds = tagRows.map((r) => r.postId);
    if (taggedIds.length === 0) return [];
  }

  const friends = await friendIds(viewer.id);
  // Own + friends' posts are always visible; everyone else's only if they don't
  // restrict posts to friends.
  const visibleIds = [viewer.id, ...friends];

  const rows = await db
    .select(postSelection)
    .from(post)
    .innerJoin(user, eq(user.id, post.userId))
    .where(
      and(
        or(inArray(post.userId, visibleIds), eq(user.friendsOnlyPosts, false)),
        q ? ilike(post.caption, `%${escapeLike(q)}%`) : undefined,
        taggedIds ? inArray(post.id, taggedIds) : undefined,
        isNull(post.deletedAt),
      ),
    )
    .orderBy(desc(post.createdAt))
    .limit(FEED_LIMIT);

  return decoratePosts(rows, viewer.id);
}

// The users who liked a given post, most recent first, for the "who liked"
// list opened by tapping the like count.
export async function getPostLikers(postId: string): Promise<PostLiker[]> {
  await getUserId();
  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      username: user.username,
      image: user.image,
      likedAt: postLike.createdAt,
    })
    .from(postLike)
    .innerJoin(user, eq(user.id, postLike.userId))
    .where(eq(postLike.postId, postId))
    .orderBy(desc(postLike.createdAt))
    .limit(200);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    username: r.username,
    image: r.image,
  }));
}

export async function toggleLike(postId: string) {
  const userId = await getUserId();
  const [existing] = await db
    .select({ id: postLike.id })
    .from(postLike)
    .where(and(eq(postLike.postId, postId), eq(postLike.userId, userId)))
    .limit(1);
  if (existing) {
    await db.delete(postLike).where(eq(postLike.id, existing.id));
    return { liked: false };
  }
  await db
    .insert(postLike)
    .values({ id: newId('like'), postId, userId })
    .onConflictDoNothing();

  // Notify the post's author that someone liked their post (unless they liked
  // their own). The like always lands in their inbox; whether it also pops a
  // toast/plays a sound is decided on the recipient's client from their
  // per-category preferences — the server never suppresses the record.
  try {
    const [p] = await db
      .select({ authorId: post.userId })
      .from(post)
      .where(eq(post.id, postId))
      .limit(1);
    if (p && p.authorId !== userId) {
      const [liker] = await db
        .select({
          name: user.name,
          username: user.username,
          image: user.image,
        })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);
      await notify({
        recipientId: p.authorId,
        actorId: userId,
        type: 'LIKE',
        // The liked post — one like notification per (liker, post) pair.
        targetId: postId,
        category: 'like',
        actor: {
          name: liker?.name ?? 'Someone',
          username: liker?.username ?? null,
          image: liker?.image ?? null,
        },
      });
    }
  } catch {
    // Notification failures must never block the like itself.
  }

  return { liked: true };
}
