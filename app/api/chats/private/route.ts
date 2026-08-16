import { NextResponse } from "next/server"
import { getCurrentUserOrNull } from "@/lib/session"
import { db } from "@/lib/db"
import { chat, chat_participant, user } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"

export async function GET() {
  const currentUser = await getCurrentUserOrNull()
  if (!currentUser) return NextResponse.json([])

  const chats = await db
    .select({
      id: chat.id,
      name: chat.name,
      type: chat.type,
      participants: db
        .select({ id: user.id, name: user.name, image: user.image })
        .from(chat_participant)
        .leftJoin(user, eq(user.id, chat_participant.userId))
        .where(
          and(
            eq(chat_participant.chatId, chat.id),
            eq(chat_participant.leftAt, null)
          )
        ),
    })
    .from(chat)
    .innerJoin(
      chat_participant,
      and(
        eq(chat_participant.chatId, chat.id),
        eq(chat_participant.userId, currentUser.id),
        eq(chat_participant.leftAt, null)
      )
    )
    .where(eq(chat.type, "PRIVATE"))

  return NextResponse.json(chats)
}
