import { NextResponse } from "next/server"
import { and, eq, isNull } from "drizzle-orm"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { chatParticipant } from "@/lib/db/schema"

// Beacon-friendly leave endpoint. `navigator.sendBeacon` sends a POST with a
// small body and cannot invoke server actions, so we expose this route and
// mark the membership as left. Safe to call repeatedly.
export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ ok: false }, { status: 401 })

  let chatId: string | null = null
  try {
    const body = await req.json()
    chatId = typeof body?.chatId === "string" ? body.chatId : null
  } catch {
    // sendBeacon with a Blob may not parse as JSON in all cases; ignore.
  }
  if (!chatId) return NextResponse.json({ ok: false }, { status: 400 })

  await db
    .update(chatParticipant)
    .set({ leftAt: new Date() })
    .where(
      and(
        eq(chatParticipant.chatId, chatId),
        eq(chatParticipant.userId, session.user.id),
        isNull(chatParticipant.leftAt),
      ),
    )

  return NextResponse.json({ ok: true })
}
