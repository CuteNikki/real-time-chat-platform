"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { UserPlus, UserCheck, MessageCircle, Bell } from "lucide-react"
import { UserAvatar } from "@/components/user-avatar"
import { cn } from "@/lib/utils"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { markNotificationsRead, getNotifications } from "@/app/actions/notifications"
import type { NotificationSummary } from "@/lib/types"

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return "just now"
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d`
  return new Date(iso).toLocaleDateString()
}

function iconFor(type: NotificationSummary["type"]) {
  if (type === "FRIEND_REQUEST") return UserPlus
  if (type === "FRIEND_ACCEPT") return UserCheck
  return MessageCircle
}

function hrefFor(n: NotificationSummary) {
  if (n.type === "FRIEND_REQUEST") return "/app/friends"
  if (n.type === "MESSAGE" && n.chatId) return `/app/messages?c=${n.chatId}`
  if (n.type === "FRIEND_ACCEPT" && n.chatId) return `/app/messages?c=${n.chatId}`
  return n.actorUsername ? `/app/u/${n.actorUsername}` : "/app/friends"
}

function isMessages(n: NotificationSummary) {
  return n.type === "MESSAGE"
}

function Row({ n }: { n: NotificationSummary }) {
  const Icon = iconFor(n.type)
  return (
    <Link
      href={hrefFor(n)}
      className={cn(
        "flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-accent",
        !n.read && "bg-card",
      )}
    >
      <div className="relative">
        <UserAvatar name={n.actorName ?? "User"} image={n.actorImage} className="size-10" />
        <span className="absolute -bottom-1 -right-1 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground ring-2 ring-background">
          <Icon className="size-3" aria-hidden />
        </span>
      </div>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-sm">
          <span className="font-medium">{n.actorName ?? "Someone"}</span>
        </p>
        {n.body ? <p className="truncate text-sm text-muted-foreground">{n.body}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {!n.read ? <span className="size-2 rounded-full bg-primary" aria-label="Unread" /> : null}
        <span className="text-xs text-muted-foreground" suppressHydrationWarning>
          {timeAgo(n.createdAt)}
        </span>
      </div>
    </Link>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-14 text-center">
      <Bell className="size-6 text-muted-foreground" aria-hidden />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  )
}

export function NotificationsView({ initial }: { initial: NotificationSummary[] }) {
  const [items, setItems] = useState(initial)
  const [tab, setTab] = useState<"requests" | "messages">("requests")

  const requests = useMemo(() => items.filter((n) => !isMessages(n)), [items])
  const messages = useMemo(() => items.filter(isMessages), [items])
  const unreadRequests = requests.filter((n) => !n.read).length
  const unreadMessages = messages.filter((n) => !n.read).length

  // Mark the active tab's notifications read shortly after viewing it.
  useEffect(() => {
    const unread = (tab === "messages" ? messages : requests).some((n) => !n.read)
    if (!unread) return
    const t = setTimeout(async () => {
      await markNotificationsRead({ category: tab })
      setItems((prev) =>
        prev.map((n) =>
          (tab === "messages" ? isMessages(n) : !isMessages(n)) ? { ...n, read: true } : n,
        ),
      )
      // Refresh the nav bell badge.
      window.dispatchEvent(new Event("notifications:read"))
    }, 800)
    return () => clearTimeout(t)
  }, [tab, requests, messages])

  // Refresh from the server when a live notification arrives elsewhere.
  useEffect(() => {
    async function refresh() {
      const fresh = await getNotifications()
      setItems(fresh)
    }
    window.addEventListener("notifications:new", refresh)
    return () => window.removeEventListener("notifications:new", refresh)
  }, [])

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as "requests" | "messages")}>
      <TabsList className="w-full">
        <TabsTrigger value="requests" className="gap-2">
          Requests
          {unreadRequests > 0 ? (
            <Badge className="h-5 min-w-5 justify-center px-1 tabular-nums">{unreadRequests}</Badge>
          ) : null}
        </TabsTrigger>
        <TabsTrigger value="messages" className="gap-2">
          Messages
          {unreadMessages > 0 ? (
            <Badge className="h-5 min-w-5 justify-center px-1 tabular-nums">{unreadMessages}</Badge>
          ) : null}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="requests" className="mt-4">
        {requests.length === 0 ? (
          <EmptyState label="No friend requests or updates yet." />
        ) : (
          <ul className="flex flex-col gap-2">
            {requests.map((n) => (
              <li key={n.id}>
                <Row n={n} />
              </li>
            ))}
          </ul>
        )}
      </TabsContent>

      <TabsContent value="messages" className="mt-4">
        {messages.length === 0 ? (
          <EmptyState label="No new message notifications." />
        ) : (
          <ul className="flex flex-col gap-2">
            {messages.map((n) => (
              <li key={n.id}>
                <Row n={n} />
              </li>
            ))}
          </ul>
        )}
      </TabsContent>
    </Tabs>
  )
}
