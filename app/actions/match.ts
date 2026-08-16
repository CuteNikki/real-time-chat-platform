"use server"

import { and, eq, isNull, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { chat, chatParticipant, randomQueue } from "@/lib/db/schema"
import { getCurrentUser } from "@/lib/session"
import { pusher } from "@/lib/pusher/server"
import { userChannel, chatChannel, EVENTS } from "@/lib/pusher/channels"
import { newId } from "@/lib/id"

type MatchResult = { status: "matched"; chatId: string; partnerName: string } | { status: "waiting" }

// Try to pair the current user with someone already waiting. If nobody is
// waiting, enqueue the user. Uses SKIP LOCKED so two simultaneous requests
// never grab the same waiting partner.
export async function requestMatch(): Promise<MatchResult> {
  const me = await getCurrentUser()

  return db.transaction(async (tx) => {
    // Grab the oldest waiting user that isn't me, locking the row.
    const waiting = await tx.execute(
      sql`SELECT "id", "userId" FROM "random_queue"
          WHERE "userId" <> ${me.id}
          ORDER BY "joinedAt" ASC
          LIMIT 1
          FOR UPDATE SKIP LOCKED`,
    )

    const partner = waiting.rows[0] as { id: string; userId: string } | undefined

    if (partner) {
      // Remove partner from queue and make sure I'm not queued either.
      await tx.delete(randomQueue).where(eq(randomQueue.userId, partner.userId))
      await tx.delete(randomQueue).where(eq(randomQueue.userId, me.id))

      // Create the chat + both participants.
      const chatId = newId("chat")
      await tx.insert(chat).values({ id: chatId, type: "RANDOM", name: null })
      await tx.insert(chatParticipant).values([
        { id: newId("cp"), chatId, userId: me.id },
        { id: newId("cp"), chatId, userId: partner.userId },
      ])

      // Look up partner name for both notifications.
      const partnerRow = await tx.execute(
        sql`SELECT "name" FROM "user" WHERE "id" = ${partner.userId} LIMIT 1`,
      )
      const partnerName = (partnerRow.rows[0] as { name: string } | undefined)?.name ?? "Someone"

      // Notify the waiting partner in real time so they navigate in.
      await pusher.trigger(userChannel(partner.userId), EVENTS.MATCH_FOUND, {
        chatId,
        partnerName: me.name,
      })

      return { status: "matched", chatId, partnerName } as const
    }

    // Nobody waiting — enqueue me (idempotent).
    await tx
      .insert(randomQueue)
      .values({ id: newId("q"), userId: me.id })
      .onConflictDoNothing({ target: randomQueue.userId })

    return { status: "waiting" } as const
  })
}

// Leave the waiting queue (user cancelled before being matched).
export async function cancelMatch() {
  const me = await getCurrentUser()
  await db.delete(randomQueue).where(eq(randomQueue.userId, me.id))
  return { ok: true }
}

// End a random chat: mark it ended, remove both participants, notify the room.
export async function endRandomChat(chatId: string) {
  const me = await getCurrentUser()

  // Verify membership.
  const [membership] = await db
    .select()
    .from(chatParticipant)
    .where(and(eq(chatParticipant.chatId, chatId), eq(chatParticipant.userId, me.id)))
    .limit(1)
  if (!membership) throw new Error("Not a member of this chat")

  await db.update(chat).set({ endedAt: new Date() }).where(and(eq(chat.id, chatId), isNull(chat.endedAt)))
  await db
    .update(chatParticipant)
    .set({ leftAt: new Date() })
    .where(and(eq(chatParticipant.chatId, chatId), isNull(chatParticipant.leftAt)))

  await pusher.trigger(chatChannel(chatId), EVENTS.CHAT_ENDED, { by: me.name })
  return { ok: true }
}

// Poll fallback: has a waiting user been matched into a chat yet?
export async function checkMatchStatus(): Promise<MatchResult> {
  const me = await getCurrentUser()

  // Still in queue → waiting.
  const [queued] = await db.select().from(randomQueue).where(eq(randomQueue.userId, me.id)).limit(1)
  if (queued) return { status: "waiting" }

  // Not in queue: find my most recent active RANDOM chat.
  const rows = await db
    .select({ chatId: chat.id })
    .from(chatParticipant)
    .innerJoin(chat, eq(chat.id, chatParticipant.chatId))
    .where(
      and(
        eq(chatParticipant.userId, me.id),
        isNull(chatParticipant.leftAt),
        eq(chat.type, "RANDOM"),
        isNull(chat.endedAt),
      ),
    )
    .orderBy(sql`${chat.createdAt} DESC`)
    .limit(1)

  if (rows[0]) return { status: "matched", chatId: rows[0].chatId, partnerName: "" }
  // Neither queued nor matched (e.g. cancelled elsewhere).
  return { status: "waiting" }
}
