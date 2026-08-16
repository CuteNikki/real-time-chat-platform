import { pusherServer } from "@/lib/pusher/server"
import { getSession } from "@/lib/session"
import { db } from "@/lib/db"
import { chatParticipant } from "@/lib/db/schema"
import { and, eq, isNull } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.text()
  const params = new URLSearchParams(body)
  const socketId = params.get("socket_id")
  const channelName = params.get("channel_name")

  if (!socketId || !channelName) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 })
  }

  // Presence channels are named "presence-chat-<chatId>". Verify the user is an
  // active participant of that chat before authorizing.
  if (channelName.startsWith("presence-chat-")) {
    const chatId = channelName.replace("presence-chat-", "")
    const [membership] = await db
      .select()
      .from(chatParticipant)
      .where(
        and(
          eq(chatParticipant.chatId, chatId),
          eq(chatParticipant.userId, session.user.id),
          isNull(chatParticipant.leftAt),
        ),
      )
      .limit(1)

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const authResponse = pusherServer.authorizeChannel(socketId, channelName, {
      user_id: session.user.id,
      user_info: { name: session.user.name },
    })
    return NextResponse.json(authResponse)
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 })
}
