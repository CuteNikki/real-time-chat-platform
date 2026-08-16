"use server"

import { and, asc, eq, isNull } from "drizzle-orm"
import { db } from "@/lib/db"
import { chat, chatParticipant, message, user } from "@/lib/db/schema"
import { getCurrentUser, getUserId } from "@/lib/session"
import { pusher } from "@/lib/pusher/server"
import { chatChannel, EVENTS } from "@/lib/pusher/channels"
import { newId } from "@/lib/id"
import type { ChatMessage } from "@/lib/types"

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
    .limit(1)
  if (!row) throw new Error("You are not a member of this chat")
}

export async function getChatMeta(chatId: string) {
  const userId = await getUserId()
  await assertActiveMembership(chatId, userId)

  const [c] = await db.select().from(chat).where(eq(chat.id, chatId)).limit(1)
  if (!c) throw new Error("Chat not found")

  return {
    id: c.id,
    type: c.type,
    name: c.name,
    endedAt: c.endedAt ? c.endedAt.toISOString() : null,
  }
}

export async function getMessages(chatId: string): Promise<ChatMessage[]> {
  const userId = await getUserId()
  await assertActiveMembership(chatId, userId)

  const rows = await db
    .select({
      id: message.id,
      chatId: message.chatId,
      senderId: message.senderId,
      content: message.content,
      imageUrl: message.imageUrl,
      createdAt: message.createdAt,
      senderName: user.name,
    })
    .from(message)
    .leftJoin(user, eq(user.id, message.senderId))
    .where(eq(message.chatId, chatId))
    .orderBy(asc(message.createdAt))

  return rows.map((r) => ({
    id: r.id,
    chatId: r.chatId,
    senderId: r.senderId,
    senderName: r.senderName ?? "Unknown",
    content: r.content,
    imageUrl: r.imageUrl,
    createdAt: r.createdAt.toISOString(),
  }))
}

export async function sendMessage(input: {
  chatId: string
  content?: string
  imageUrl?: string
}): Promise<ChatMessage> {
  const currentUser = await getCurrentUser()
  const userId = currentUser.id
  await assertActiveMembership(input.chatId, userId)

  const content = input.content?.trim() || null
  const imageUrl = input.imageUrl || null
  if (!content && !imageUrl) throw new Error("Message is empty")
  if (content && content.length > 2000) throw new Error("Message too long")

  // Make sure the chat is still active.
  const [c] = await db.select().from(chat).where(eq(chat.id, input.chatId)).limit(1)
  if (!c) throw new Error("Chat not found")
  if (c.endedAt) throw new Error("This chat has ended")

  const id = newId("msg")
  const createdAt = new Date()
  await db.insert(message).values({
    id,
    chatId: input.chatId,
    senderId: userId,
    content,
    imageUrl,
    createdAt,
  })

  const payload: ChatMessage = {
    id,
    chatId: input.chatId,
    senderId: userId,
    senderName: currentUser.name,
    content,
    imageUrl,
    createdAt: createdAt.toISOString(),
  }

  await pusher.trigger(chatChannel(input.chatId), EVENTS.NEW_MESSAGE, payload)

  return payload
}
