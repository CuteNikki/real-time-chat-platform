import { NextResponse } from "next/server"
import { and, eq, count } from "drizzle-orm"
import { db } from "@/lib/db"
import { invite } from "@/lib/db/schema"
import { getCurrentUserOrNull } from "@/lib/session"

export async function GET() {
  const user = await getCurrentUserOrNull()
  if (!user) return NextResponse.json({ count: 0 })

  const [row] = await db
    .select({ value: count() })
    .from(invite)
    .where(and(eq(invite.receiverId, user.id), eq(invite.status, "PENDING")))

  return NextResponse.json({ count: row?.value ?? 0 })
}
