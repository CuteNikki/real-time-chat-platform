"use server"

import { and, desc, eq, isNull, inArray, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { notification, user } from "@/lib/db/schema"
import { getCurrentUser, getUserId } from "@/lib/session"
import { pusherServer } from "@/lib/pusher/server"
import { userChannel, EVENTS } from "@/lib/pusher/channels"
import { newId } from "@/lib/id"
import type { NotificationSummary, NotificationType } from "@/lib/types"

// Create a notification row and push it to the recipient in real time.
// Safe to call from other server actions; never throws to the caller's flow.
export async function createNotification(input: {
  userId: string
  type: NotificationType
  actorId?: string | null
  chatId?: string | null
  body?: string | null
}) {
  try {
    const id = newId("ntf")
    await db.insert(notification).values({
      id,
      userId: input.userId,
      type: input.type,
      actorId: input.actorId ?? null,
      chatId: input.chatId ?? null,
      body: input.body ?? null,
    })
    await pusherServer.trigger(userChannel(input.userId), EVENTS.NOTIFICATION, {
      id,
      type: input.type,
      body: input.body ?? null,
    })
  } catch (err) {
    console.log("[v0] createNotification failed:", err instanceof Error ? err.message : err)
  }
}

// The "Messages" tab collapses per-chat message notifications; "Requests"
// covers friend requests and accepts. We categorize by type.
function categoryOf(type: string): "requests" | "messages" {
  return type === "MESSAGE" ? "messages" : "requests"
}

export async function getNotifications(): Promise<NotificationSummary[]> {
  const me = await getCurrentUser()
  const rows = await db
    .select({
      id: notification.id,
      type: notification.type,
      actorId: notification.actorId,
      chatId: notification.chatId,
      body: notification.body,
      readAt: notification.readAt,
      createdAt: notification.createdAt,
      actorName: user.name,
      actorUsername: user.username,
      actorImage: user.image,
    })
    .from(notification)
    .leftJoin(user, eq(user.id, notification.actorId))
    .where(eq(notification.userId, me.id))
    .orderBy(desc(notification.createdAt))
    .limit(100)

  return rows.map((r) => ({
    id: r.id,
    type: r.type as NotificationType,
    actorId: r.actorId,
    actorName: r.actorName,
    actorUsername: r.actorUsername,
    actorImage: r.actorImage,
    chatId: r.chatId,
    body: r.body,
    read: r.readAt !== null,
    createdAt: r.createdAt.toISOString(),
  }))
}

// Unread counts split into the two inbox tabs plus a total for the bell badge.
export async function getUnreadCounts() {
  const userId = await getUserId()
  const rows = await db
    .select({ type: notification.type, count: sql<number>`count(*)` })
    .from(notification)
    .where(and(eq(notification.userId, userId), isNull(notification.readAt)))
    .groupBy(notification.type)

  let requests = 0
  let messages = 0
  for (const r of rows) {
    if (categoryOf(r.type) === "messages") messages += Number(r.count)
    else requests += Number(r.count)
  }
  return { requests, messages, total: requests + messages }
}

// Mark a set of notifications read, or a whole category, or everything.
export async function markNotificationsRead(opts?: {
  ids?: string[]
  category?: "requests" | "messages"
}) {
  const userId = await getUserId()
  const base = and(eq(notification.userId, userId), isNull(notification.readAt))

  if (opts?.ids && opts.ids.length) {
    await db
      .update(notification)
      .set({ readAt: new Date() })
      .where(and(base, inArray(notification.id, opts.ids)))
  } else if (opts?.category === "messages") {
    await db
      .update(notification)
      .set({ readAt: new Date() })
      .where(and(base, eq(notification.type, "MESSAGE")))
  } else if (opts?.category === "requests") {
    await db
      .update(notification)
      .set({ readAt: new Date() })
      .where(and(base, inArray(notification.type, ["FRIEND_REQUEST", "FRIEND_ACCEPT"])))
  } else {
    await db.update(notification).set({ readAt: new Date() }).where(base)
  }
  return { ok: true }
}
