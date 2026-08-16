import { getCurrentUser } from "@/lib/session"
import { getPendingInvites, getPrivateConversations } from "@/app/actions/invites"
import { PrivateBrowser } from "@/components/private-browser"

export const metadata = { title: "Private Chats" }

export default async function PrivatePage() {
  const me = await getCurrentUser()
  const [conversations, invites] = await Promise.all([
    getPrivateConversations(),
    getPendingInvites(),
  ])

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-6 py-4">
        <h1 className="text-2xl font-semibold tracking-tight">Private Chats</h1>
        <p className="text-sm text-muted-foreground">
          Invite friends or continue existing conversations
        </p>
      </div>
      <PrivateBrowser
        userId={me.id}
        initialConversations={conversations}
        initialInvites={invites}
      />
    </div>
  )
}
