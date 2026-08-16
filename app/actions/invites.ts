"use server"

import { and, desc, eq, isNull, ne, or } from "drizzle-orm"
import { db } from "@/lib/db"
import { chat, chatParticipant, invite, message, user } from "@/lib/db/schema"
import { getCurrentUser } from "@/lib/session"
import { pusher } from "@/lib/pusher/server"
import { userChannel, EVENTS } from "@/lib/pusher/channels"
import { newId } from "@/lib/id"
import type { InviteSummary } from "@/lib/types"

// Send a private-chat invite to a user by email.
export async function sendInvite(email: string) {
  const me = await getCurrentUser()
  const target = email.trim().toLowerCase()
  if (!target) throw new Error("Enter an email address")
  if (target === me.email.toLowerCase()) throw new Error("You can't invite yourself")

  const [receiver] = await db.select().from(user).where(eq(user.email, target)).limit(1)
  if (!receiver) throw new Error("No account found with that email")

  // Prevent duplicate pending invites in either direction.
  const [existingPending] = await db
    .select()
    .from(invite)
    .where(
      and(
        eq(invite.status, "PENDING"),
        or(
          and(eq(invite.senderId, me.id), eq(invite.receiverId, receiver.id)),
          and(eq(invite.senderId, receiver.id), eq(invite.receiverId, me.id)),
        ),
      ),
    )
    .limit(1)
  if (existingPending) throw new Error("There's already a pending invite between you two")

  const id = newId("inv")
  await db.insert(invite).values({
    id,
    senderId: me.id,
    receiverId: receiver.id,
    status: "PENDING",
  })

  // Realtime notify the receiver.
  await pusher.trigger(userChannel(receiver.id), EVENTS.INVITE_RECEIVED, {
    id,
    senderName: me.name,
    senderEmail: me.email,
  })

  return { ok: true }
}

export async function respondToInvite(inviteId: string, accept: boolean) {
  const me = await getCurrentUser()

  const [inv] = await db.select().from(invite).where(eq(invite.id, inviteId)).limit(1)
  if (!inv) throw new Error("Invite not found")
  if (inv.receiverId !== me.id) throw new Error("This invite isn't for you")
  if (inv.status !== "PENDING") throw new Error("This invite was already handled")

  if (!accept) {
    await db
      .update(invite)
      .set({ status: "DECLINED", respondedAt: new Date() })
      .where(eq(invite.id, inviteId))
    await pusher.trigger(userChannel(inv.senderId), EVENTS.INVITE_RESPONDED, {
      id: inviteId,
      accepted: false,
    })
    return { status: "declined" as const }
  }

  // Accept: create a PRIVATE chat with both participants.
  const chatId = newId("chat")
  await db.insert(chat).values({ id: chatId, type: "PRIVATE", name: null })
  await db.insert(chatParticipant).values([
    { id: newId("cp"), chatId, userId: inv.senderId },
    { id: newId("cp"), chatId, userId: inv.receiverId },
  ])
  await db
    .update(invite)
    .set({ status: "ACCEPTED", respondedAt: new Date(), chatId })
    .where(eq(invite.id, inviteId))

  await pusher.trigger(userChannel(inv.senderId), EVENTS.INVITE_RESPONDED, {
    id: inviteId,
    accepted: true,
    chatId,
    partnerName: me.name,
  })

  return { status: "accepted" as const, chatId }
}

// Invites the current user has received that are still pending.
export async function getPendingInvites(): Promise<InviteSummary[]> {
  const me = await getCurrentUser()
  const rows = await db
    .select({
      id: invite.id,
      senderId: invite.senderId,
      receiverId: invite.receiverId,
      status: invite.status,
      chatId: invite.chatId,
      createdAt: invite.createdAt,
      senderName: user.name,
      senderEmail: user.email,
    })
    .from(invite)
    .innerJoin(user, eq(user.id, invite.senderId))
    .where(and(eq(invite.receiverId, me.id), eq(invite.status, "PENDING")))
    .orderBy(desc(invite.createdAt))

  return rows.map((r) => ({
    id: r.id,
    senderId: r.senderId,
    senderName: r.senderName,
    senderEmail: r.senderEmail,
    receiverId: r.receiverId,
    status: r.status as InviteSummary["status"],
    chatId: r.chatId,
    createdAt: r.createdAt.toISOString(),
  }))
}

export type PrivateConversation = {
  chatId: string
  partnerName: string
  partnerId: string
  lastMessage: string | null
  lastAt: string | null
}

// Active private chats for the current user, with a short preview.
export async function getPrivateConversations(): Promise<PrivateConversation[]> {
  const me = await getCurrentUser()

  const myChats = await db
    .select({ chatId: chatParticipant.chatId })
    .from(chatParticipant)
    .innerJoin(chat, eq(chat.id, chatParticipant.chatId))
    .where(
      and(
        eq(chatParticipant.userId, me.id),
        isNull(chatParticipant.leftAt),
        eq(chat.type, "PRIVATE"),
        isNull(chat.endedAt),
      ),
    )

  const results: PrivateConversation[] = []
  for (const { chatId } of myChats) {
    const [partner] = await db
      .select({ id: user.id, name: user.name })
      .from(chatParticipant)
      .innerJoin(user, eq(user.id, chatParticipant.userId))
      .where(and(eq(chatParticipant.chatId, chatId), ne(chatParticipant.userId, me.id)))
      .limit(1)

    const [last] = await db
      .select({ content: message.content, imageUrl: message.imageUrl, createdAt: message.createdAt })
      .from(message)
      .where(eq(message.chatId, chatId))
      .orderBy(desc(message.createdAt))
      .limit(1)

    results.push({
      chatId,
      partnerId: partner?.id ?? "",
      partnerName: partner?.name ?? "Unknown",
      lastMessage: last ? (last.content ?? (last.imageUrl ? "Sent an image" : null)) : null,
      lastAt: last ? last.createdAt.toISOString() : null,
    })
  }

  // Sort by most recent activity.
  results.sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? ""))
  return results
}
