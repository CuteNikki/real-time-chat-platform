"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { toast } from "sonner"
import { sendInvite, respondToInvite } from "@/app/actions/invites"
import type { PrivateConversation } from "@/app/actions/invites"
import type { InviteSummary } from "@/lib/types"
import { getPusherClient } from "@/lib/pusher/client"
import { userChannel, EVENTS } from "@/lib/pusher/channels"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Lock, UserPlus, Check, X, MessageSquare } from "lucide-react"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function initials(name: string) {
  return (
    name
      .split(" ")
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  )
}

export function PrivateBrowser({
  userId,
  initialConversations,
  initialInvites,
}: {
  userId: string
  initialConversations: PrivateConversation[]
  initialInvites: InviteSummary[]
}) {
  const router = useRouter()

  const { data: conversations = initialConversations, mutate: mutateConvos } = useSWR<PrivateConversation[]>(
    "/api/private/conversations",
    fetcher,
    { fallbackData: initialConversations, refreshInterval: 10000 },
  )
  const { data: invites = initialInvites, mutate: mutateInvites } = useSWR<InviteSummary[]>(
    "/api/invites/pending",
    fetcher,
    { fallbackData: initialInvites, refreshInterval: 10000 },
  )

  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [inviting, setInviting] = useState(false)
  const [respondingId, setRespondingId] = useState<string | null>(null)

  // Realtime: incoming invites + responses to invites I sent.
  useEffect(() => {
    const pusher = getPusherClient()
    const channel = pusher.subscribe(userChannel(userId))

    const onInvite = (data: { senderName: string }) => {
      toast.message(`${data.senderName} invited you to a private chat`)
      mutateInvites()
    }
    const onResponded = (data: { accepted: boolean; chatId?: string; partnerName?: string }) => {
      if (data.accepted) {
        toast.success(`${data.partnerName ?? "Your invite"} accepted your invite`)
        mutateConvos()
      } else {
        toast.message("Your invite was declined")
      }
    }

    channel.bind(EVENTS.INVITE_RECEIVED, onInvite)
    channel.bind(EVENTS.INVITE_RESPONDED, onResponded)
    return () => {
      channel.unbind(EVENTS.INVITE_RECEIVED, onInvite)
      channel.unbind(EVENTS.INVITE_RESPONDED, onResponded)
      pusher.unsubscribe(userChannel(userId))
    }
  }, [userId, mutateInvites, mutateConvos])

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || inviting) return
    setInviting(true)
    try {
      await sendInvite(email)
      toast.success("Invite sent")
      setOpen(false)
      setEmail("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send invite")
    } finally {
      setInviting(false)
    }
  }

  async function respond(inviteId: string, accept: boolean) {
    setRespondingId(inviteId)
    try {
      const res = await respondToInvite(inviteId, accept)
      mutateInvites()
      if (res.status === "accepted") {
        mutateConvos()
        router.push(`/app/chat/${res.chatId}`)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not respond")
      setRespondingId(null)
      mutateInvites()
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Private chats</h1>
          <p className="mt-1 text-sm text-muted-foreground">Invite friends by email and chat one-on-one.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button className="gap-2" />}>
            <UserPlus className="size-4" aria-hidden />
            <span className="hidden sm:inline">Invite</span>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleInvite}>
              <DialogHeader>
                <DialogTitle>Invite to a private chat</DialogTitle>
                <DialogDescription>
                  Enter the email of someone with an Orbit account. They&apos;ll get an invite to accept.
                </DialogDescription>
              </DialogHeader>
              <div className="my-5 flex flex-col gap-2">
                <Label htmlFor="invite-email">Email address</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="friend@example.com"
                  autoFocus
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={inviting || !email.trim()}>
                  {inviting ? "Sending…" : "Send invite"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Pending invites */}
      {invites.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-medium text-muted-foreground">Pending invites</h2>
          <ul className="mt-3 flex flex-col gap-3">
            {invites.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center gap-4 rounded-xl border border-primary/30 bg-accent/40 p-4"
              >
                <Avatar className="size-10 shrink-0">
                  <AvatarFallback className="bg-primary text-sm font-medium text-primary-foreground">
                    {initials(inv.senderName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{inv.senderName}</p>
                  <p className="truncate text-xs text-muted-foreground">{inv.senderEmail}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="icon"
                    variant="outline"
                    className="bg-transparent"
                    aria-label="Decline"
                    disabled={respondingId === inv.id}
                    onClick={() => respond(inv.id, false)}
                  >
                    <X className="size-4" aria-hidden />
                  </Button>
                  <Button
                    size="icon"
                    aria-label="Accept"
                    disabled={respondingId === inv.id}
                    onClick={() => respond(inv.id, true)}
                  >
                    <Check className="size-4" aria-hidden />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Conversations */}
      <section className="mt-8">
        <h2 className="text-sm font-medium text-muted-foreground">Conversations</h2>
        {conversations.length === 0 ? (
          <div className="mt-3 flex flex-col items-center rounded-xl border border-dashed border-border py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <Lock className="size-6" aria-hidden />
            </div>
            <p className="mt-4 font-medium">No private chats yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Invite someone by email to get started.</p>
          </div>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {conversations.map((c) => (
              <li key={c.chatId}>
                <button
                  onClick={() => router.push(`/app/chat/${c.chatId}`)}
                  className="flex w-full items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/40"
                >
                  <Avatar className="size-11 shrink-0">
                    <AvatarFallback className="bg-secondary text-sm font-medium text-secondary-foreground">
                      {initials(c.partnerName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{c.partnerName}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {c.lastMessage ?? "No messages yet"}
                    </p>
                  </div>
                  <MessageSquare className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
