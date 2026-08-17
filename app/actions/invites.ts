"use server"

import { and, desc, eq, isNull, ne, or } from "drizzle-orm"
import { db } from "@/lib/db"
import { chat, chatParticipant, invite, message, user } from "@/lib/db/schema"
import { getCurrentUser } from "@/lib/session"
import { pusherServer } from "@/lib/pusher/server"
import { userChannel, EVENTS } from "@/lib/pusher/channels"
import { newId } from "@/lib/id"
import { createNotification } from "@/app/actions/notifications"
import type { InviteSummary, OutgoingInviteSummary } from "@/lib/types"

// Send a friend request to a user by their id (resolved from a profile/search).
export async function sendFriendRequest(targetUserId: string) {
  const me = await getCurrentUser()
  if (targetUserId === me.id) throw new Error("You can't add yourself")

  const [receiver] = await db
    .select()
    .from(user)
    .where(eq(user.id, targetUserId))
    .limit(1)
  if (!receiver) throw new Error("User not found")

  // If already friends or a request already exists in either direction, stop.
  const existing = await db
    .select()
    .from(invite)
    .where(
      or(
        and(eq(invite.senderId, me.id), eq(invite.receiverId, receiver.id)),
        and(eq(invite.senderId, receiver.id), eq(invite.receiverId, me.id)),
      ),
    )
  const accepted = existing.find((e) => e.status === "ACCEPTED")
  if (accepted) throw new Error("You're already friends")
  const pending = existing.find((e) => e.status === "PENDING")
  if (pending) {
    // If they already requested us, accept it instead of creating a dup.
    if (pending.receiverId === me.id) {
      return respondToRequest(pending.id, true)
    }
    throw new Error("Friend request already sent")
  }

  const id = newId("inv")
  await db.insert(invite).values({
    id,
    senderId: me.id,
    receiverId: receiver.id,
    status: "PENDING",
  })

  await pusherServer.trigger(userChannel(receiver.id), EVENTS.INVITE_RECEIVED, {
    id,
    senderName: me.name,
    senderUsername: me.username ?? null,
  })

  await createNotification({
    userId: receiver.id,
    type: "FRIEND_REQUEST",
    actorId: me.id,
    body: `${me.name} sent you a friend request`,
  })

  return { ok: true, status: "sent" as const }
}

// Convenience wrapper: send a request by username.
export async function sendFriendRequestByUsername(username: string) {
  const uname = username.trim().toLowerCase().replace(/^@/, "")
  const [target] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.username, uname))
    .limit(1)
  if (!target) throw new Error("No user found with that username")
  return sendFriendRequest(target.id)
}

// Pull back a friend request you sent that is still pending.
export async function cancelFriendRequest(targetUserId: string) {
  const me = await getCurrentUser()
  const rows = await db
    .select()
    .from(invite)
    .where(
      and(
        eq(invite.senderId, me.id),
        eq(invite.receiverId, targetUserId),
        eq(invite.status, "PENDING"),
      ),
    )
  if (rows.length === 0) throw new Error("No pending request to cancel")
  for (const r of rows) {
    await db.delete(invite).where(eq(invite.id, r.id))
  }
  // Let the recipient's client drop the incoming request in real time.
  await pusherServer.trigger(userChannel(targetUserId), EVENTS.INVITE_CANCELED, {
    senderId: me.id,
  })
  return { ok: true }
}

export async function respondToRequest(inviteId: string, accept: boolean) {
  const me = await getCurrentUser()

  const [inv] = await db.select().from(invite).where(eq(invite.id, inviteId)).limit(1)
  if (!inv) throw new Error("Request not found")
  if (inv.receiverId !== me.id) throw new Error("This request isn't for you")
  if (inv.status !== "PENDING") throw new Error("This request was already handled")

  if (!accept) {
    await db
      .update(invite)
      .set({ status: "DECLINED", respondedAt: new Date() })
      .where(eq(invite.id, inviteId))
    await pusherServer.trigger(userChannel(inv.senderId), EVENTS.INVITE_RESPONDED, {
      id: inviteId,
      accepted: false,
    })
    return { status: "declined" as const }
  }

  // Accept: create a PRIVATE chat with both participants so they can DM.
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

  await pusherServer.trigger(userChannel(inv.senderId), EVENTS.INVITE_RESPONDED, {
    id: inviteId,
    accepted: true,
    chatId,
    partnerName: me.name,
  })

  await createNotification({
    userId: inv.senderId,
    type: "FRIEND_ACCEPT",
    actorId: me.id,
    chatId,
    body: `${me.name} accepted your friend request`,
  })

  return { status: "accepted" as const, chatId }
}

// Remove a friend (delete the accepted relationship + close DM).
export async function removeFriend(otherUserId: string) {
  const me = await getCurrentUser()
  const rows = await db
    .select()
    .from(invite)
    .where(
      and(
        eq(invite.status, "ACCEPTED"),
        or(
          and(eq(invite.senderId, me.id), eq(invite.receiverId, otherUserId)),
          and(eq(invite.senderId, otherUserId), eq(invite.receiverId, me.id)),
        ),
      ),
    )
  for (const r of rows) {
    await db.delete(invite).where(eq(invite.id, r.id))
  }
  return { ok: true }
}

// Friend requests the current user has received that are still pending.
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
      senderUsername: user.username,
      senderImage: user.image,
    })
    .from(invite)
    .innerJoin(user, eq(user.id, invite.senderId))
    .where(and(eq(invite.receiverId, me.id), eq(invite.status, "PENDING")))
    .orderBy(desc(invite.createdAt))

  return rows.map((r) => ({
    id: r.id,
    senderId: r.senderId,
    senderName: r.senderName,
    senderUsername: r.senderUsername,
    senderImage: r.senderImage,
    receiverId: r.receiverId,
    status: r.status as InviteSummary["status"],
    chatId: r.chatId,
    createdAt: r.createdAt.toISOString(),
  }))
}

// Friend requests the current user has SENT that are still pending, so they
// can review and pull back outgoing requests (e.g. to users they can no longer
// find in search).
export async function getSentInvites(): Promise<OutgoingInviteSummary[]> {
  const me = await getCurrentUser()
  const rows = await db
    .select({
      id: invite.id,
      receiverId: invite.receiverId,
      createdAt: invite.createdAt,
      receiverName: user.name,
      receiverUsername: user.username,
      receiverImage: user.image,
    })
    .from(invite)
    .innerJoin(user, eq(user.id, invite.receiverId))
    .where(and(eq(invite.senderId, me.id), eq(invite.status, "PENDING")))
    .orderBy(desc(invite.createdAt))

  return rows.map((r) => ({
    id: r.id,
    receiverId: r.receiverId,
    receiverName: r.receiverName,
    receiverUsername: r.receiverUsername,
    receiverImage: r.receiverImage,
    createdAt: r.createdAt.toISOString(),
  }))
}

export type PrivateConversation = {
  chatId: string
  partnerId: string
  partnerName: string
  partnerUsername: string | null
  partnerImage: string | null
  lastMessage: string | null
  lastAt: string | null
  lastFromMe: boolean
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
      .select({ id: user.id, name: user.name, username: user.username, image: user.image })
      .from(chatParticipant)
      .innerJoin(user, eq(user.id, chatParticipant.userId))
      .where(and(eq(chatParticipant.chatId, chatId), ne(chatParticipant.userId, me.id)))
      .limit(1)

    const [last] = await db
      .select({
        content: message.content,
        imageUrl: message.imageUrl,
        createdAt: message.createdAt,
        senderId: message.senderId,
      })
      .from(message)
      .where(eq(message.chatId, chatId))
      .orderBy(desc(message.createdAt))
      .limit(1)

    results.push({
      chatId,
      partnerId: partner?.id ?? "",
      partnerName: partner?.name ?? "Unknown",
      partnerUsername: partner?.username ?? null,
      partnerImage: partner?.image ?? null,
      lastMessage: last ? (last.content ?? (last.imageUrl ? "Sent an image" : null)) : null,
      lastAt: last ? last.createdAt.toISOString() : null,
      lastFromMe: last ? last.senderId === me.id : false,
    })
  }

  results.sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? ""))
  return results
}

// Ids of the current user's accepted friends (used to scope the home feed).
export async function getFriendIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ senderId: invite.senderId, receiverId: invite.receiverId })
    .from(invite)
    .where(
      and(
        eq(invite.status, "ACCEPTED"),
        or(eq(invite.senderId, userId), eq(invite.receiverId, userId)),
      ),
    )
  return rows.map((r) => (r.senderId === userId ? r.receiverId : r.senderId))
}
