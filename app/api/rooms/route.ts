import { NextResponse } from "next/server"
import { listRooms } from "@/app/actions/rooms"
import { getCurrentUserOrNull } from "@/lib/session"

export async function GET() {
  const user = await getCurrentUserOrNull()
  if (!user) return NextResponse.json([], { status: 200 })
  const rooms = await listRooms()
  return NextResponse.json(rooms)
}
