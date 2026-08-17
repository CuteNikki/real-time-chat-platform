'use server';

import { and, asc, eq, isNull, ne } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chat, chatParticipant, message, user } from '@/lib/db/schema';
import { getCurrentUser, getUserId } from '@/lib/session';
import { pusherServer } from '@/lib/pusher/server';
import { chatChannel, EVENTS } from '@/lib/pusher/channels';
import { newId } from '@/lib/id';
import { createNotification } from '@/app/actions/notifications';
import type { ChatMessage } from '@/lib/types';

// Throws if the user is not an active participant of the chat.
export async function assertActiveMembership(chatId: string, userId: string) {
  const [row] = await db
    .select()
    .from(chatParticipant)
    .where(
      and(
        eq(chatParticipant.chatId, chatId),
        eq(chatParticipant.userId, userId),
        isNull(chatParticipant.leftAt),
      ),
    )
    .limit(1);
  if (!row) throw new Error('You are not a member of this chat');
}

export async function getChatMeta(chatId: string) {
  const userId = await getUserId();
  await assertActiveMembership(chatId, userId);

  const [c] = await db.select().from(chat).where(eq(chat.id, chatId)).limit(1);
  if (!c) throw new Error('Chat not found');

  return {
    id: c.id,
    type: c.type,
    name: c.name,
    endedAt: c.endedAt ? c.endedAt.toISOString() : null,
  };
}

// Permanently delete every message in a chat. Messages are shared rows, so
// this clears the conversation for both participants. The chat + friendship
// stay intact. Restricted to active members of the chat.
export async function clearChat(chatId: string) {
  const userId = await getUserId();
  await assertActiveMembership(chatId, userId);
  await db.delete(message).where(eq(message.chatId, chatId));
  await pusherServer.trigger(chatChannel(chatId), EVENTS.CHAT_CLEARED, {
    by: userId,
  });
  return { ok: true };
}

export async function getMessages(chatId: string): Promise<ChatMessage[]> {
  const userId = await getUserId();
  await assertActiveMembership(chatId, userId);

  const rows = await db
    .select({
      id: message.id,
      chatId: message.chatId,
      senderId: message.senderId,
      content: message.content,
      imageUrl: message.imageUrl,
      createdAt: message.createdAt,
      senderName: user.name,
      senderImage: user.image,
    })
    .from(message)
    .leftJoin(user, eq(user.id, message.senderId))
    .where(eq(message.chatId, chatId))
    .orderBy(asc(message.createdAt));

  return rows.map((r) => ({
    id: r.id,
    chatId: r.chatId,
    senderId: r.senderId,
    senderName: r.senderName ?? 'Unknown',
    senderImage: r.senderImage,
    content: r.content,
    imageUrl: r.imageUrl,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function sendMessage(input: {
  chatId: string;
  content?: string;
  imageUrl?: string;
  clientId?: string;
}): Promise<ChatMessage> {
  const currentUser = await getCurrentUser();
  const userId = currentUser.id;
  await assertActiveMembership(input.chatId, userId);

  const content = input.content?.trim() || null;
  const imageUrl = input.imageUrl || null;
  if (!content && !imageUrl) throw new Error('Message is empty');
  if (content && content.length > 2000) throw new Error('Message too long');

  // Make sure the chat is still active.
  const [c] = await db
    .select()
    .from(chat)
    .where(eq(chat.id, input.chatId))
    .limit(1);
  if (!c) throw new Error('Chat not found');
  if (c.endedAt) throw new Error('This chat has ended');

  // Reuse the client-provided id so the sender's optimistic message, the saved
  // row, and the realtime echo all share one id and dedupe cleanly.
  const id = input.clientId || newId('msg');
  const createdAt = new Date();
  await db.insert(message).values({
    id,
    chatId: input.chatId,
    senderId: userId,
    content,
    imageUrl,
    createdAt,
  });

  const payload: ChatMessage = {
    id,
    chatId: input.chatId,
    senderId: userId,
    senderName: currentUser.name,
    senderImage: currentUser.image ?? null,
    content,
    imageUrl,
    createdAt: createdAt.toISOString(),
  };

  await pusherServer.trigger(
    chatChannel(input.chatId),
    EVENTS.NEW_MESSAGE,
    payload,
  );

  // Notify the other participants of private DMs and group rooms so it lands in
  // their inbox. Direct and room messages map to separate preference categories.
  // Random-match chats are excluded (you're actively in the session).
  if (c.type === 'PRIVATE' || c.type === 'GROUP') {
    const isRoom = c.type === 'GROUP';
    const recipients = await db
      .select({ userId: chatParticipant.userId })
      .from(chatParticipant)
      .where(
        and(
          eq(chatParticipant.chatId, input.chatId),
          ne(chatParticipant.userId, userId),
          isNull(chatParticipant.leftAt),
        ),
      );
    const preview = content
      ? content.slice(0, 80)
      : imageUrl
        ? 'Sent an image'
        : '';
    // Room messages prefix the room name so the inbox shows where it came from.
    const body = isRoom
      ? `${c.name ?? 'Room'} · ${currentUser.name}: ${preview}`
      : `${currentUser.name}: ${preview}`;
    for (const r of recipients) {
      await createNotification({
        userId: r.userId,
        type: 'MESSAGE',
        actorId: userId,
        chatId: input.chatId,
        body,
        category: isRoom ? 'roomMessage' : 'directMessage',
      });
    }
  }

  return payload;
}
