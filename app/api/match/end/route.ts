import { NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { chat, chatParticipant, message } from "@/lib/db/schema"
import { pusherServer } from "@/lib/pusher/server"
import { chatChannel, EVENTS } from "@/lib/pusher/channels"

// Beacon-friendly end endpoint for RANDOM (1-on-1 match) chats. Called when a
// user navigates away, closes the tab, or the chat unmounts. Marks the chat
// ended, drops participants, and notifies the partner so their view updates.
export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ ok: false }, { status: 401 })

  let chatId: string | null = null
  try {
    const body = await req.json()
    chatId = typeof body?.chatId === "string" ? body.chatId : null
  } catch {
    // ignore parse failures from sendBeacon Blob
  }
  if (!chatId) return NextResponse.json({ ok: false }, { status: 400 })

  // Verify the caller is a participant before ending.
  const [membership] = await db
    .select()
    .from(chatParticipant)
    .where(and(eq(chatParticipant.chatId, chatId), eq(chatParticipant.userId, session.user.id)))
    .limit(1)
  if (!membership) return NextResponse.json({ ok: false }, { status: 403 })

  const [c] = await db.select().from(chat).where(eq(chat.id, chatId)).limit(1)
  if (!c || c.type !== "RANDOM") return NextResponse.json({ ok: true })

  // Notify the partner first (so their client shows the disconnect banner)…
  await pusherServer.trigger(chatChannel(chatId), EVENTS.CHAT_ENDED, {
    by: session.user.name,
    disconnected: true,
  })

  // …then fully delete the ephemeral match: messages, participants, chat row.
  await db.delete(message).where(eq(message.chatId, chatId))
  await db.delete(chatParticipant).where(eq(chatParticipant.chatId, chatId))
  await db.delete(chat).where(eq(chat.id, chatId))

  return NextResponse.json({ ok: true })
}
