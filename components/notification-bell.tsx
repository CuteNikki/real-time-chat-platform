"use client"

import { useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import useSWR from "swr"
import { toast } from "sonner"
import { Bell } from "lucide-react"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getPusherClient } from "@/lib/pusher/client"
import { userChannel, EVENTS } from "@/lib/pusher/channels"

type Counts = { requests: number; messages: number; total: number }

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function NotificationBell({ userId }: { userId: string }) {
  const pathname = usePathname()
  const { data, mutate } = useSWR<Counts>("/api/notifications/unread-count", fetcher, {
    refreshInterval: 20000,
  })
  const total = data?.total ?? 0

  useEffect(() => {
    const pusher = getPusherClient()
    const channel = pusher.subscribe(userChannel(userId))

    const onNotification = (payload: { type?: string; body?: string | null }) => {
      // Refresh the badge, let an open inbox reload, and surface a toast.
      mutate()
      window.dispatchEvent(new Event("notifications:new"))
      if (payload?.body) {
        toast(payload.body, {
          action: {
            label: "View",
            onClick: () => {
              window.location.href = "/app/notifications"
            },
          },
        })
      }
    }

    channel.bind(EVENTS.NOTIFICATION, onNotification)
    return () => {
      channel.unbind(EVENTS.NOTIFICATION, onNotification)
      // Leave the channel subscribed for other listeners (invites); just unbind ours.
    }
  }, [userId, mutate])

  // Clear the badge as soon as the user opens the inbox.
  useEffect(() => {
    if (pathname === "/app/notifications") mutate()
  }, [pathname, mutate])

  // The inbox marks items read; re-fetch the badge count when it does.
  useEffect(() => {
    const onRead = () => mutate()
    window.addEventListener("notifications:read", onRead)
    return () => window.removeEventListener("notifications:read", onRead)
  }, [mutate])

  const active = pathname === "/app/notifications"

  return (
    <Link
      href="/app/notifications"
      aria-label={total > 0 ? `Notifications, ${total} unread` : "Notifications"}
      className={cn(
        buttonVariants({ variant: active ? "secondary" : "ghost", size: "icon" }),
        "relative",
      )}
    >
      <Bell className="size-5" aria-hidden />
      {total > 0 && (
        <Badge
          className="absolute -right-1 -top-1 h-5 min-w-5 justify-center px-1 text-[10px] tabular-nums"
          variant="default"
        >
          {total > 99 ? "99+" : total}
        </Badge>
      )}
    </Link>
  )
}
