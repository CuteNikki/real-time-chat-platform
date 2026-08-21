'use server';

import { db } from '@/lib/db';
import { post, postLike, user, invite } from '@/lib/db/schema';
import { newId } from '@/lib/id';
import { getCurrentUser, getUserId } from '@/lib/session';
import {
  createNotification,
  deleteNotificationByKey,
} from '@/app/actions/notifications';
import { getNotificationPreferencesFor } from '@/app/actions/preferences';
import type { PostLiker, PostSummary } from '@/lib/types';
import { and, desc, eq, inArray, or, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

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
  revalidatePath('/app/feed');
  revalidatePath('/app/settings/[tab]', 'page');
  return { id };
}

export async function deletePost(postId: string) {
  const userId = await getUserId();
  // Scope the delete to the owner so no one can delete another user's post.
  const [owned] = await db
    .select({ id: post.id })
    .from(post)
    .where(and(eq(post.id, postId), eq(post.userId, userId)))
    .limit(1);
  if (!owned) throw new Error('You can only delete your own posts');

  await db
    .delete(post)
    .where(and(eq(post.id, postId), eq(post.userId, userId)));
  await db.delete(postLike).where(eq(postLike.postId, postId));
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
    .select({ id: post.id })
    .from(post)
    .where(and(eq(post.id, postId), eq(post.userId, userId)))
    .limit(1);
  if (!owned) throw new Error('You can only edit your own posts');

  await db
    .update(post)
    .set({ caption: next || null })
    .where(and(eq(post.id, postId), eq(post.userId, userId)));
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
    .where(eq(post.userId, profileUserId))
    .orderBy(desc(post.createdAt));
  return decoratePosts(rows, viewer.id);
}

export async function getFeed(): Promise<PostSummary[]> {
  const viewer = await getCurrentUser();
  const friends = await friendIds(viewer.id);
  // Feed = your own posts + your friends' posts.
  const authorIds = [viewer.id, ...friends];
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
    .where(inArray(post.userId, authorIds))
    .orderBy(desc(post.createdAt))
    .limit(100);
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
    // Retract the LIKE notification this like created — the like no longer
    // exists, so a like/unlike spam shouldn't leave a dead entry behind.
    try {
      const [p] = await db
        .select({ authorId: post.userId })
        .from(post)
        .where(eq(post.id, postId))
        .limit(1);
      if (p) {
        await deleteNotificationByKey({
          userId: p.authorId,
          type: 'LIKE',
          actorId: userId,
          postId,
        });
      }
    } catch {
      // Notification cleanup must never block the unlike itself.
    }
    return { liked: false };
  }
  await db
    .insert(postLike)
    .values({ id: newId('like'), postId, userId })
    .onConflictDoNothing();

  // Notify the post's author that someone liked their post, unless they liked
  // their own post or have opted out of like popups.
  try {
    const [p] = await db
      .select({ authorId: post.userId })
      .from(post)
      .where(eq(post.id, postId))
      .limit(1);
    if (p && p.authorId !== userId) {
      const prefs = await getNotificationPreferencesFor(p.authorId);
      if (prefs.categories.like.popup) {
        const [liker] = await db
          .select({ name: user.name })
          .from(user)
          .where(eq(user.id, userId))
          .limit(1);
        await createNotification({
          userId: p.authorId,
          type: 'LIKE',
          actorId: userId,
          postId,
          body: `${liker?.name ?? 'Someone'} liked your post`,
        });
      }
    }
  } catch {
    // Notification failures must never block the like itself.
  }

  return { liked: true };
}
