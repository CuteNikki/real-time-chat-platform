'use server';

import { and, count, desc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  chat,
  chatParticipant,
  message,
  notification,
  report,
} from '@/lib/db/schema';
import { getCurrentUser } from '@/lib/session';
import { requireRole } from '@/lib/roles-server';
import { newId } from '@/lib/id';
import type { RoomSummary } from '@/lib/types';

// List all open group rooms with a live-ish member count (active participants).
export async function listRooms(): Promise<RoomSummary[]> {
  await getCurrentUser();

  const rows = await db
    .select({
      id: chat.id,
      name: chat.name,
      createdAt: chat.createdAt,
      memberCount: sql<number>`count(${chatParticipant.id}) filter (where ${chatParticipant.leftAt} is null)`,
    })
    .from(chat)
    .leftJoin(chatParticipant, eq(chatParticipant.chatId, chat.id))
    .where(and(eq(chat.type, 'GROUP'), isNull(chat.endedAt)))
    .groupBy(chat.id, chat.name, chat.createdAt)
    .orderBy(desc(chat.createdAt));

  return rows.map((r) => ({
    id: r.id,
    name: r.name ?? 'Untitled room',
    memberCount: Number(r.memberCount ?? 0),
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function createRoom(name: string): Promise<{ chatId: string }> {
  const me = await getCurrentUser();
  // Only moderators and admins may create group chats.
  await requireRole('MODERATOR');
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Room name is required');
  if (trimmed.length > 60) throw new Error('Room name is too long');

  const chatId = newId('chat');
  await db.insert(chat).values({ id: chatId, type: 'GROUP', name: trimmed });
  await db
    .insert(chatParticipant)
    .values({ id: newId('cp'), chatId, userId: me.id });
  return { chatId };
}

// Join a room (idempotent — reactivates a previous membership if the user left).
export async function joinRoom(chatId: string): Promise<{ chatId: string }> {
  const me = await getCurrentUser();

  const [c] = await db
    .select()
    .from(chat)
    .where(
      and(eq(chat.id, chatId), eq(chat.type, 'GROUP'), isNull(chat.endedAt)),
    )
    .limit(1);
  if (!c) throw new Error('Room not found');

  const [existing] = await db
    .select()
    .from(chatParticipant)
    .where(
      and(
        eq(chatParticipant.chatId, chatId),
        eq(chatParticipant.userId, me.id),
      ),
    )
    .limit(1);

  if (existing) {
    if (existing.leftAt) {
      await db
        .update(chatParticipant)
        .set({ leftAt: null, joinedAt: new Date() })
        .where(eq(chatParticipant.id, existing.id));
    }
  } else {
    await db
      .insert(chatParticipant)
      .values({ id: newId('cp'), chatId, userId: me.id });
  }

  return { chatId };
}

// Permanently delete a group room and everything tied to it (messages,
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
  await db.delete(notification).where(eq(notification.chatId, chatId));
  await db.delete(message).where(eq(message.chatId, chatId));
  await db.delete(chatParticipant).where(eq(chatParticipant.chatId, chatId));
  await db.delete(chat).where(eq(chat.id, chatId));

  return { ok: true };
}

export async function leaveRoom(chatId: string) {
  const me = await getCurrentUser();
  await db
    .update(chatParticipant)
    .set({ leftAt: new Date() })
    .where(
      and(
        eq(chatParticipant.chatId, chatId),
        eq(chatParticipant.userId, me.id),
        isNull(chatParticipant.leftAt),
      ),
    );
  return { ok: true };
}

// Rooms the current user is currently a member of.
export async function myRooms(): Promise<RoomSummary[]> {
  const me = await getCurrentUser();

  const myMemberships = db
    .select({ chatId: chatParticipant.chatId })
    .from(chatParticipant)
    .where(
      and(eq(chatParticipant.userId, me.id), isNull(chatParticipant.leftAt)),
    );

  const rows = await db
    .select({
      id: chat.id,
      name: chat.name,
      createdAt: chat.createdAt,
      memberCount: sql<number>`count(${chatParticipant.id}) filter (where ${chatParticipant.leftAt} is null)`,
    })
    .from(chat)
    .leftJoin(chatParticipant, eq(chatParticipant.chatId, chat.id))
    .where(
      and(
        eq(chat.type, 'GROUP'),
        isNull(chat.endedAt),
        sql`${chat.id} in ${myMemberships}`,
      ),
    )
    .groupBy(chat.id, chat.name, chat.createdAt)
    .orderBy(desc(chat.createdAt));

  return rows.map((r) => ({
    id: r.id,
    name: r.name ?? 'Untitled room',
    memberCount: Number(r.memberCount ?? 0),
    createdAt: r.createdAt.toISOString(),
  }));
}

// Guard used elsewhere if needed.
export async function roomMemberCount(chatId: string) {
  const [row] = await db
    .select({ value: count() })
    .from(chatParticipant)
    .where(
      and(eq(chatParticipant.chatId, chatId), isNull(chatParticipant.leftAt)),
    );
  return row?.value ?? 0;
}
