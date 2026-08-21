'use server';

import { and, eq, isNull } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  chat,
  chatParticipant,
  message,
  notification,
  report,
} from '@/lib/db/schema';
import { newId } from '@/lib/id';
import { chatChannel } from '@/lib/pusher/channels';
import { pusherServer } from '@/lib/pusher/server';
import { requireRole } from '@/lib/roles-server';
import { getCurrentUser } from '@/lib/session';
import type { RoomSummary } from '@/lib/types';

// List all open group rooms with their live member count. Rooms are public
// drop-in channels with no durable membership, so occupancy comes straight from
// Pusher presence — the single source of truth for who's actually connected.
export async function listRooms(): Promise<RoomSummary[]> {
  await getCurrentUser();

  const rows = await db
    .select({ id: chat.id, name: chat.name, createdAt: chat.createdAt })
    .from(chat)
    .where(and(eq(chat.type, 'GROUP'), isNull(chat.endedAt)));

  // One HTTP call returns the head-count for every occupied room channel;
  // rooms with nobody connected are simply absent (count 0). Because this reads
  // live presence rather than persisted rows, the count can't drift. Fail open
  // to 0 if the lookup itself errors.
  const counts = new Map<string, number>();
  try {
    const res = await pusherServer.get({
      path: '/channels',
      params: { filter_by_prefix: 'presence-chat-', info: 'user_count' },
    });
    const data = (await res.json()) as {
      channels?: Record<string, { user_count?: number }>;
    };
    for (const [channel, meta] of Object.entries(data.channels ?? {})) {
      counts.set(channel, meta.user_count ?? 0);
    }
  } catch (err) {
    console.log(
      '[v0] room presence count lookup failed, showing 0:',
      err instanceof Error ? err.message : err,
    );
  }

  // Busiest rooms first; stable by age (oldest first) within a tie.
  return rows
    .map((r) => ({
      id: r.id,
      name: r.name ?? 'Untitled room',
      memberCount: counts.get(chatChannel(r.id)) ?? 0,
      createdAt: r.createdAt.toISOString(),
    }))
    .sort(
      (a, b) =>
        b.memberCount - a.memberCount || a.createdAt.localeCompare(b.createdAt),
    );
}

export async function createRoom(name: string): Promise<{ chatId: string }> {
  await getCurrentUser();
  // Only moderators and admins may create group chats.
  await requireRole('MODERATOR');
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Room name is required');
  if (trimmed.length > 60) throw new Error('Room name is too long');

  // No membership row — the room is public and presence tracks occupancy.
  const chatId = newId('chat');
  await db.insert(chat).values({ id: chatId, type: 'GROUP', name: trimmed });
  return { chatId };
}
// participants, and any reports/notifications that referenced it). Restricted
// to moderators and admins.
export async function deleteRoom(chatId: string) {
  await getCurrentUser();
  await requireRole('MODERATOR');

  const [c] = await db
    .select({ id: chat.id, type: chat.type })
    .from(chat)
    .where(eq(chat.id, chatId))
    .limit(1);
  if (!c) throw new Error('Room not found');
  if (c.type !== 'GROUP') throw new Error('Only group rooms can be deleted');

  // Remove dependent records first, then the chat itself.
  await db.delete(report).where(eq(report.chatId, chatId));
  // A room message's notification stores the room's chatId as its targetId.
  await db.delete(notification).where(eq(notification.targetId, chatId));
  await db.delete(message).where(eq(message.chatId, chatId));
  await db.delete(chatParticipant).where(eq(chatParticipant.chatId, chatId));
  await db.delete(chat).where(eq(chat.id, chatId));

  return { ok: true };
}
