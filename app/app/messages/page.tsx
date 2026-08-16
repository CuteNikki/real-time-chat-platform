import { redirect } from "next/navigation"
import { getMyProfile } from "@/app/actions/profile"
import { getPrivateConversations } from "@/app/actions/invites"
import { MessagesWorkspace } from "@/components/messages-workspace"

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>
}) {
  const me = await getMyProfile()
  if (!me) redirect("/sign-in")

  const { c } = await searchParams
  const conversations = await getPrivateConversations()

  return (
    <MessagesWorkspace
      currentUserId={me.id}
      currentUserName={me.name}
      conversations={conversations}
      initialChatId={c ?? null}
    />
  )
}
