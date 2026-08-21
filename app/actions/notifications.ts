'use server';

import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';

import { db } from '@/lib/db';
import { invite, notification, post, user } from '@/lib/db/schema';
import { newId } from '@/lib/id';
import { tabForType } from '@/lib/notifications';
import { EVENTS, userChannel } from '@/lib/pusher/channels';
import { pusherServer } from '@/lib/pusher/server';
import { getCurrentUser, getUserId } from '@/lib/session';
import type {
  NotificationCategory,
  NotificationMetadata,
  NotificationRealtimePayload,
  NotificationSummary,
  NotificationType,
} from '@/lib/types';

// targetId is a single, unified pointer. Project it back to the specific
// deep-link fields the UI understands, based on the notification type. For a
// MENTION, only a post-sourced tag points at a post (profile tags target the
// actor's own id, which is not a post).
function deriveLinks(
  type: NotificationType,
  targetId: string,
  metadata?: NotificationMetadata | null,
) {
  const isPostMention =
    type === 'MENTION' && metadata?.mentionSource === 'post';
  return {
    chatId: type === 'MESSAGE' || type === 'FRIEND_ACCEPT' ? targetId : null,
    postId: type === 'LIKE' || isPostMention ? targetId : null,
  };
}

// Create-or-refresh a notification and push it to the recipient in real time.
//
// Deduplication is atomic: a unique index on (recipientId, actorId, type,
// targetId) plus ON CONFLICT DO UPDATE means re-emitting the same event (a
// repeat message from the same person in the same chat, a re-sent request)
// UPDATES the existing row instead of inserting a duplicate. No delete-then-
// insert race, so a single event can never produce two rows.
//
// Only structured data is persisted — the actor's display fields ride along on
// the realtime payload (so the toast can render an avatar + name without a
// round-trip) but are never stored, avoiding stale/duplicated names.
//
// Safe to call from other server actions; it never throws into their flow.
export async function notify(input: {
  recipientId: string;
  actorId: string;
  type: NotificationType;
  // chatId for MESSAGE / FRIEND_ACCEPT, postId for LIKE, actorId for a request.
  targetId: string;
  // Preference category, forwarded to the client for popup/sound gating.
  category: NotificationCategory;
  metadata?: NotificationMetadata | null;
  // Actor display fields, sent on the realtime payload only (not persisted).
  actor: { name: string; username: string | null; image: string | null };
}) {
  try {
    const id = newId('ntf');
    const now = new Date();
    const metadata = input.metadata ?? null;

    const [row] = await db
      .insert(notification)
      .values({
        id,
        recipientId: input.recipientId,
        actorId: input.actorId,
        type: input.type,
        targetId: input.targetId,
        metadata,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          notification.recipientId,
          notification.actorId,
          notification.type,
          notification.targetId,
        ],
        set: {
          metadata,
          // Resurface at the top of the inbox and mark unread again, since a
          // fresh event just occurred.
          createdAt: now,
          updatedAt: now,
          readAt: null,
        },
      })
      .returning({ id: notification.id, createdAt: notification.createdAt });

    const links = deriveLinks(input.type, input.targetId, metadata);
    const payload: NotificationRealtimePayload = {
      id: row?.id ?? id,
      type: input.type,
      category: input.category,
      actor: { id: input.actorId, ...input.actor },
      targetId: input.targetId,
      chatId: links.chatId,
      postId: links.postId,
      metadata,
      createdAt: (row?.createdAt ?? now).toISOString(),
    };
    await pusherServer.trigger(
      userChannel(input.recipientId),
      EVENTS.NOTIFICATION,
      payload,
    );
  } catch (err) {
    console.log(
      '[v0] notify failed:',
      err instanceof Error ? err.message : err,
    );
  }
}

export async function getNotifications(): Promise<NotificationSummary[]> {
  const me = await getCurrentUser();
  const rows = await db
    .select({
      id: notification.id,
      type: notification.type,
      actorId: notification.actorId,
      targetId: notification.targetId,
      metadata: notification.metadata,
      readAt: notification.readAt,
      createdAt: notification.createdAt,
      actorName: user.name,
      actorUsername: user.username,
      actorImage: user.image,
      // Joined live for LIKE rows and post @mentions (targetId is the postId).
      // Null for other types — their targetId never matches a post row — or if
      // the post is gone.
      postImage: post.imageUrl,
      postCaption: post.caption,
    })
    .from(notification)
    .leftJoin(user, eq(user.id, notification.actorId))
    .leftJoin(post, eq(post.id, notification.targetId))
    .where(eq(notification.recipientId, me.id))
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

  return rows.map((r) => {
    const type = r.type as NotificationType;
    const metadata = (r.metadata as NotificationMetadata | null) ?? null;
    const { chatId, postId } = deriveLinks(type, r.targetId, metadata);
    return {
      id: r.id,
      type,
      actorId: r.actorId,
      actorName: r.actorName,
      actorUsername: r.actorUsername,
      actorImage: r.actorImage,
      targetId: r.targetId,
      chatId,
      postId,
      metadata,
      // A LIKE / post-mention target always has an image or a caption, so both
      // being null means the post was deleted (or the target isn't a post, as
      // with a profile mention) — render without a preview in that case.
      post:
        (type === 'LIKE' || type === 'MENTION') &&
        (r.postImage !== null || r.postCaption !== null)
          ? { imageUrl: r.postImage, caption: r.postCaption }
          : null,
      read: r.readAt !== null,
      createdAt: r.createdAt.toISOString(),
      inviteId:
        type === 'FRIEND_REQUEST' && r.actorId
          ? (inviteByActor.get(r.actorId) ?? null)
          : null,
    };
  });
}

// Delete a single notification (used to dismiss after reading).
export async function deleteNotification(id: string) {
  const userId = await getUserId();
  await db
    .delete(notification)
    .where(and(eq(notification.id, id), eq(notification.recipientId, userId)));
  return { ok: true };
}

// Delete many notifications at once: a whole category, or everything.
export async function clearNotifications(opts?: {
  category?: 'requests' | 'messages' | 'likes' | 'mentions';
}) {
  const userId = await getUserId();
  const base = eq(notification.recipientId, userId);
  if (opts?.category === 'messages') {
    await db
      .delete(notification)
      .where(and(base, eq(notification.type, 'MESSAGE')));
  } else if (opts?.category === 'likes') {
    await db
      .delete(notification)
      .where(and(base, eq(notification.type, 'LIKE')));
  } else if (opts?.category === 'mentions') {
    await db
      .delete(notification)
      .where(and(base, eq(notification.type, 'MENTION')));
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

// Unread counts split into the inbox tabs plus a total for the bell badge.
export async function getUnreadCounts() {
  const userId = await getUserId();
  const rows = await db
    .select({ type: notification.type, count: sql<number>`count(*)` })
    .from(notification)
    .where(
      and(eq(notification.recipientId, userId), isNull(notification.readAt)),
    )
    .groupBy(notification.type);

  let requests = 0;
  let messages = 0;
  let likes = 0;
  let mentions = 0;
  for (const r of rows) {
    const tab = tabForType(r.type as NotificationType);
    if (tab === 'messages') messages += Number(r.count);
    else if (tab === 'likes') likes += Number(r.count);
    else if (tab === 'mentions') mentions += Number(r.count);
    else requests += Number(r.count);
  }
  return {
    requests,
    messages,
    likes,
    mentions,
    total: requests + messages + likes + mentions,
  };
}

// Mark a set of notifications read, or a whole category, or everything.
export async function markNotificationsRead(opts?: {
  ids?: string[];
  category?: 'requests' | 'messages' | 'likes' | 'mentions';
}) {
  const userId = await getUserId();
  const base = and(
    eq(notification.recipientId, userId),
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
  } else if (opts?.category === 'mentions') {
    await db
      .update(notification)
      .set({ readAt: new Date() })
      .where(and(base, eq(notification.type, 'MENTION')));
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
