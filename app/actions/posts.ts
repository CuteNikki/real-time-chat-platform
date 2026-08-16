"use server"

import { db } from "@/lib/db"
import { post, postLike, user, invite } from "@/lib/db/schema"
import { newId } from "@/lib/id"
import { getCurrentUser, getUserId } from "@/lib/session"
import type { PostSummary } from "@/lib/types"
import { and, desc, eq, inArray, or, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"

// Ids of a user's accepted friends.
async function friendIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ senderId: invite.senderId, receiverId: invite.receiverId })
    .from(invite)
    .where(
      and(
        eq(invite.status, "ACCEPTED"),
        or(eq(invite.senderId, userId), eq(invite.receiverId, userId)),
      ),
    )
  const ids = new Set<string>()
  for (const r of rows) {
    ids.add(r.senderId === userId ? r.receiverId : r.senderId)
  }
  return [...ids]
}

// Map post rows + like aggregates into PostSummary[].
async function decoratePosts(
  rows: {
    id: string
    userId: string
    imageUrl: string
    caption: string | null
    createdAt: Date
    authorName: string
    authorUsername: string | null
    authorImage: string | null
  }[],
  viewerId: string,
): Promise<PostSummary[]> {
  if (rows.length === 0) return []
  const ids = rows.map((r) => r.id)

  const likeCounts = await db
    .select({ postId: postLike.postId, c: sql<number>`count(*)::int` })
    .from(postLike)
    .where(inArray(postLike.postId, ids))
    .groupBy(postLike.postId)
  const countMap = new Map(likeCounts.map((l) => [l.postId, l.c]))

  const myLikes = await db
    .select({ postId: postLike.postId })
    .from(postLike)
    .where(and(inArray(postLike.postId, ids), eq(postLike.userId, viewerId)))
  const likedSet = new Set(myLikes.map((l) => l.postId))

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
  }))
}

export async function createPost(input: { imageUrl: string; caption?: string }) {
  const userId = await getUserId()
  if (!input.imageUrl) throw new Error("An image is required")
  const caption = input.caption?.trim() || null
  if (caption && caption.length > 500) throw new Error("Caption too long")

  const id = newId("post")
  await db.insert(post).values({ id, userId, imageUrl: input.imageUrl, caption })
  revalidatePath("/app/feed")
  revalidatePath("/app/settings")
  return { id }
}

export async function deletePost(postId: string) {
  const userId = await getUserId()
  await db.delete(post).where(and(eq(post.id, postId), eq(post.userId, userId)))
  await db.delete(postLike).where(eq(postLike.postId, postId))
  revalidatePath("/app/feed")
  return { ok: true }
}

export async function getUserPosts(profileUserId: string): Promise<PostSummary[]> {
  const viewer = await getCurrentUser()
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
    .orderBy(desc(post.createdAt))
  return decoratePosts(rows, viewer.id)
}

export async function getFeed(): Promise<PostSummary[]> {
  const viewer = await getCurrentUser()
  const friends = await friendIds(viewer.id)
  // Feed = your own posts + your friends' posts.
  const authorIds = [viewer.id, ...friends]
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
    .limit(100)
  return decoratePosts(rows, viewer.id)
}

export async function toggleLike(postId: string) {
  const userId = await getUserId()
  const [existing] = await db
    .select({ id: postLike.id })
    .from(postLike)
    .where(and(eq(postLike.postId, postId), eq(postLike.userId, userId)))
    .limit(1)
  if (existing) {
    await db.delete(postLike).where(eq(postLike.id, existing.id))
    return { liked: false }
  }
  await db
    .insert(postLike)
    .values({ id: newId("like"), postId, userId })
    .onConflictDoNothing()
  return { liked: true }
}
