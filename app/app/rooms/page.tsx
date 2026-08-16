import { listRooms } from "@/app/actions/rooms"
import { RoomsBrowser } from "@/components/rooms-browser"

export default async function RoomsPage() {
  const rooms = await listRooms()
  return <RoomsBrowser initialRooms={rooms} />
}
