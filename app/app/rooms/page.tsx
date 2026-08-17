import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { listRooms } from "@/app/actions/rooms"
import { getMyRole } from "@/lib/roles-server"
import { canCreateGroups } from "@/lib/roles"
import { RoomsWorkspace } from "@/components/rooms-workspace"

export default async function RoomsPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect("/sign-in")

  const rooms = await listRooms()
  const role = await getMyRole()
  return (
    <RoomsWorkspace
      initialRooms={rooms}
      me={{ id: session.user.id, name: session.user.name }}
      canCreate={canCreateGroups(role)}
    />
  )
}
