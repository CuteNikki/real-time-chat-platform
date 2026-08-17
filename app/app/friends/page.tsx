import { redirect } from "next/navigation"
import { getMyProfile } from "@/app/actions/profile"
import { getPendingInvites, getSentInvites } from "@/app/actions/invites"
import { FriendsView } from "@/components/friends-view"

export default async function FriendsPage() {
  const me = await getMyProfile()
  if (!me) redirect("/sign-in")

  const [pending, sent] = await Promise.all([getPendingInvites(), getSentInvites()])

  return (
    <div className="mx-auto h-full w-full max-w-2xl overflow-y-auto px-4 py-8">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Friends</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Find people by name, username, or shared interests, then send a request. Once accepted, you can DM each
        other.
      </p>
      <FriendsView initialIncoming={pending} initialOutgoing={sent} />
    </div>
  )
}
