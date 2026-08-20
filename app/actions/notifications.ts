'use server';

import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';

import { db } from '@/lib/db';
import { invite, notification, user } from '@/lib/db/schema';
import { newId } from '@/lib/id';
import { EVENTS, userChannel } from '@/lib/pusher/channels';
import { pusherServer } from '@/lib/pusher/server';
import { getCurrentUser, getUserId } from '@/lib/session';
import type {
  NotificationCategory,
  NotificationSummary,
  NotificationType,
} from '@/lib/types';

// Create a notification row and push it to the recipient in real time.
// Safe to call from other server actions; never throws to the caller's flow.
export async function createNotification(input: {
  userId: string;
  type: NotificationType;
  actorId?: string | null;
  chatId?: string | null;
  // Set for LIKE notifications so the inbox can deep-link to the post.
  postId?: string | null;
  body?: string | null;
  // Optional preference category override. MESSAGE notifications use this to
  // distinguish a direct message from a room message (both share the DB type).
  category?: NotificationCategory;
}) {
  try {
    const id = newId('ntf');
    await db.insert(notification).values({
      id,
      userId: input.userId,
      type: input.type,
      actorId: input.actorId ?? null,
      chatId: input.chatId ?? null,
      postId: input.postId ?? null,
      body: input.body ?? null,
    });
    await pusherServer.trigger(userChannel(input.userId), EVENTS.NOTIFICATION, {
      id,
      type: input.type,
      category: input.category ?? null,
      postId: input.postId ?? null,
      body: input.body ?? null,
    });
  } catch (err) {
    console.log(
      '[v0] createNotification failed:',
      err instanceof Error ? err.message : err,
    );
  }
}

// The inbox splits into three tabs: "Messages" for per-chat message
// notifications, "Likes" for post likes, and "Requests" for friend requests
// and accepts.
function categoryOf(type: string): 'requests' | 'messages' | 'likes' {
  if (type === 'MESSAGE') return 'messages';
  if (type === 'LIKE') return 'likes';
  return 'requests';
}

export async function getNotifications(): Promise<NotificationSummary[]> {
  const me = await getCurrentUser();
  const rows = await db
    .select({
      id: notification.id,
      type: notification.type,
      actorId: notification.actorId,
      chatId: notification.chatId,
      postId: notification.postId,
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
    .limit(100);

  // For friend-request notifications, resolve the still-pending invite so the
  // menu can offer inline Accept/Decline. One extra query for all of them.
  const requestActorIds = rows
    .filter((r) => r.type === 'FRIEND_REQUEST' && r.actorId)
    .map((r) => r.actorId as string);

  const inviteByActor = new Map<string, string>();
  if (requestActorIds.length) {
    const invites = await db
      .select({ id: invite.id, senderId: invite.senderId })
      .from(invite)
      .where(
        and(
          eq(invite.receiverId, me.id),
          eq(invite.status, 'PENDING'),
          inArray(invite.senderId, requestActorIds),
        ),
      );
    for (const iv of invites) inviteByActor.set(iv.senderId, iv.id);
  }

  return rows.map((r) => ({
    id: r.id,
    type: r.type as NotificationType,
    actorId: r.actorId,
    actorName: r.actorName,
    actorUsername: r.actorUsername,
    actorImage: r.actorImage,
    chatId: r.chatId,
    postId: r.postId,
    body: r.body,
    read: r.readAt !== null,
    createdAt: r.createdAt.toISOString(),
    inviteId:
      r.type === 'FRIEND_REQUEST' && r.actorId
        ? (inviteByActor.get(r.actorId) ?? null)
        : null,
  }));
}

// Delete a single notification (used to dismiss after reading).
export async function deleteNotification(id: string) {
  const userId = await getUserId();
  await db
    .delete(notification)
    .where(and(eq(notification.id, id), eq(notification.userId, userId)));
  return { ok: true };
}

// Delete many notifications at once: a whole category, or everything.
export async function clearNotifications(opts?: {
  category?: 'requests' | 'messages' | 'likes';
}) {
  const userId = await getUserId();
  const base = eq(notification.userId, userId);
  if (opts?.category === 'messages') {
    await db
      .delete(notification)
      .where(and(base, eq(notification.type, 'MESSAGE')));
  } else if (opts?.category === 'likes') {
    await db
      .delete(notification)
      .where(and(base, eq(notification.type, 'LIKE')));
  } else if (opts?.category === 'requests') {
    await db
      .delete(notification)
      .where(
        and(
          base,
          inArray(notification.type, ['FRIEND_REQUEST', 'FRIEND_ACCEPT']),
        ),
      );
  } else {
    await db.delete(notification).where(base);
  }
  return { ok: true };
}

// Unread counts split into the three inbox tabs plus a total for the bell badge.
export async function getUnreadCounts() {
  const userId = await getUserId();
  const rows = await db
    .select({ type: notification.type, count: sql<number>`count(*)` })
    .from(notification)
    .where(and(eq(notification.userId, userId), isNull(notification.readAt)))
    .groupBy(notification.type);

  let requests = 0;
  let messages = 0;
  let likes = 0;
  for (const r of rows) {
    const cat = categoryOf(r.type);
    if (cat === 'messages') messages += Number(r.count);
    else if (cat === 'likes') likes += Number(r.count);
    else requests += Number(r.count);
  }
  return { requests, messages, likes, total: requests + messages + likes };
}

// Mark a set of notifications read, or a whole category, or everything.
export async function markNotificationsRead(opts?: {
  ids?: string[];
  category?: 'requests' | 'messages' | 'likes';
}) {
  const userId = await getUserId();
  const base = and(
    eq(notification.userId, userId),
    isNull(notification.readAt),
  );

  if (opts?.ids && opts.ids.length) {
    await db
      .update(notification)
      .set({ readAt: new Date() })
      .where(and(base, inArray(notification.id, opts.ids)));
  } else if (opts?.category === 'messages') {
    await db
      .update(notification)
      .set({ readAt: new Date() })
      .where(and(base, eq(notification.type, 'MESSAGE')));
  } else if (opts?.category === 'likes') {
    await db
      .update(notification)
      .set({ readAt: new Date() })
      .where(and(base, eq(notification.type, 'LIKE')));
  } else if (opts?.category === 'requests') {
    await db
      .update(notification)
      .set({ readAt: new Date() })
      .where(
        and(
          base,
          inArray(notification.type, ['FRIEND_REQUEST', 'FRIEND_ACCEPT']),
        ),
      );
  } else {
    await db.update(notification).set({ readAt: new Date() }).where(base);
  }
  return { ok: true };
}

export async function upsertNotification(
  input: Parameters<typeof createNotification>[0],
) {
  await db
    .delete(notification)
    .where(
      and(
        eq(notification.userId, input.userId),
        eq(notification.type, input.type),
        input.actorId
          ? eq(notification.actorId, input.actorId)
          : isNull(notification.actorId),
        input.postId
          ? eq(notification.postId, input.postId)
          : isNull(notification.postId),
      ),
    );
  return createNotification(input);
}
