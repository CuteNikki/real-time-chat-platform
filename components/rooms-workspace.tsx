"use client"

import type React from "react"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import useSWR from "swr"
import { toast } from "sonner"
import { createRoom, joinRoom } from "@/app/actions/rooms"
import { getMessages } from "@/app/actions/chat"
import { useRoomMembers } from "@/hooks/use-room-members"
import { ChatRoom } from "@/components/chat-room"
import { UserPreviewDialog } from "@/components/user-preview"
import type { ChatMessage, RoomSummary } from "@/lib/types"
import { cn } from "@/lib/utils"
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
import { Plus, Users, Hash, ArrowLeft, MessageSquare, Loader2 } from "lucide-react"

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

export function RoomsWorkspace({
  initialRooms,
  me,
  canCreate = false,
}: {
  initialRooms: RoomSummary[]
  me: { id: string; name: string }
  canCreate?: boolean
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlChatId = searchParams.get("c")

  const { data: rooms = initialRooms, mutate } = useSWR<RoomSummary[]>("/api/rooms", fetcher, {
    fallbackData: initialRooms,
    refreshInterval: 5000,
  })

  const [activeChatId, setActiveChatId] = useState<string | null>(urlChatId)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)

  // The user whose profile preview popup is open (null = closed).
  const [previewUserId, setPreviewUserId] = useState<string | null>(null)

  // Dialog state for creating a channel.
  const [dialogOpen, setDialogOpen] = useState(false)
  const [name, setName] = useState("")
  const [creating, setCreating] = useState(false)

  const members = useRoomMembers(activeChatId)
  const activeRoom = rooms.find((r) => r.id === activeChatId) ?? null

  // Track the last channel we loaded so re-renders don't refetch endlessly.
  const loadedFor = useRef<string | null>(null)

  // Fire-and-forget leave that survives page unloads (uses sendBeacon).
  const beaconLeave = useCallback((chatId: string) => {
    if (!chatId) return
    const payload = JSON.stringify({ chatId })
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon("/api/rooms/leave", new Blob([payload], { type: "application/json" }))
    } else {
      void fetch("/api/rooms/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      })
    }
  }, [])

  const openChannel = useCallback(
    async (chatId: string) => {
      if (loadedFor.current === chatId) return
      // Leave the previously active channel before switching.
      if (loadedFor.current && loadedFor.current !== chatId) {
        beaconLeave(loadedFor.current)
      }
      loadedFor.current = chatId
      setActiveChatId(chatId)
      setLoading(true)
      router.replace(`/app/rooms?c=${chatId}`, { scroll: false })
      try {
        await joinRoom(chatId)
        const msgs = await getMessages(chatId)
        setMessages(msgs)
        mutate()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not open channel")
        loadedFor.current = null
        setActiveChatId(null)
      } finally {
        setLoading(false)
      }
    },
    [router, mutate, beaconLeave],
  )

  // Auto-leave the active channel when the user navigates away, closes the tab,
  // or this workspace unmounts — no explicit "Leave" button needed.
  useEffect(() => {
    function handlePageHide() {
      if (loadedFor.current) beaconLeave(loadedFor.current)
    }
    window.addEventListener("pagehide", handlePageHide)
    return () => {
      window.removeEventListener("pagehide", handlePageHide)
      if (loadedFor.current) beaconLeave(loadedFor.current)
    }
  }, [beaconLeave])

  // Open the channel referenced in the URL on first load / back-forward nav.
  useEffect(() => {
    if (urlChatId && loadedFor.current !== urlChatId) {
      void openChannel(urlChatId)
    }
    if (!urlChatId) {
      loadedFor.current = null
      setActiveChatId(null)
    }
  }, [urlChatId, openChannel])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || creating) return
    setCreating(true)
    try {
      const { chatId } = await createRoom(name)
      setDialogOpen(false)
      setName("")
      await mutate()
      void openChannel(chatId)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create room")
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left rail: channels + members */}
      <aside
        className={cn(
          "flex w-full flex-col border-r border-border bg-card md:w-72 lg:w-80",
          activeChatId && "hidden md:flex",
        )}
      >
        {/* Channels */}
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center justify-between px-4 pb-2 pt-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Channels</h2>
            <span className="text-xs text-muted-foreground">{rooms.length}</span>
          </div>
          {canCreate && (
            <div className="px-3">
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger render={<Button className="w-full gap-2" size="sm" />}>
                  <Plus className="size-4" aria-hidden />
                  Create channel
                </DialogTrigger>
                <DialogContent>
                  <form onSubmit={handleCreate}>
                    <DialogHeader>
                      <DialogTitle>Create a channel</DialogTitle>
                      <DialogDescription>Give it a name. Anyone can find and join it.</DialogDescription>
                    </DialogHeader>
                    <div className="my-5 flex flex-col gap-2">
                      <Label htmlFor="room-name">Channel name</Label>
                      <Input
                        id="room-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. late night talks"
                        maxLength={60}
                        autoFocus
                      />
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={creating || !name.trim()}>
                        {creating ? "Creating…" : "Create & enter"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          )}

          <nav className="mt-2 min-h-0 flex-1 overflow-y-auto px-3 pb-3">
            {rooms.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">No channels yet. Create the first one.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {rooms.map((room) => {
                  const active = room.id === activeChatId
                  return (
                    <li key={room.id}>
                      <button
                        type="button"
                        onClick={() => openChannel(room.id)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                          active
                            ? "bg-primary text-primary-foreground"
                            : "text-foreground hover:bg-secondary",
                        )}
                      >
                        <Hash
                          className={cn("size-4 shrink-0", active ? "text-primary-foreground/80" : "text-muted-foreground")}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1 truncate font-medium">{room.name}</span>
                        <span
                          className={cn(
                            "flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
                            active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-secondary text-muted-foreground",
                          )}
                        >
                          {room.memberCount}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </nav>
        </div>

        {/* Members of the active channel */}
        <div className="flex min-h-0 flex-1 flex-col border-t border-border">
          <div className="px-4 pb-2 pt-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {activeChatId ? `${members.length} online in this chat` : "Online"}
            </h2>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
            {!activeChatId ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">Pick a channel to see who&apos;s here.</p>
            ) : members.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">Connecting…</p>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {members.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => setPreviewUserId(m.id)}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-secondary"
                      aria-label={m.isMe ? "View your profile" : `View ${m.name}'s profile`}
                    >
                      <div className="relative shrink-0">
                        <Avatar className="size-7">
                          <AvatarFallback className="bg-secondary text-[11px] font-medium text-secondary-foreground">
                            {initials(m.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span
                          className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-card bg-primary"
                          aria-hidden
                        />
                      </div>
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {m.name}
                        {m.isMe && <span className="ml-1 text-xs text-muted-foreground">(you)</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </aside>

      {/* Main pane */}
      <main className={cn("flex min-w-0 flex-1 flex-col bg-background", !activeChatId && "hidden md:flex")}>
        {!activeChatId ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
              <MessageSquare className="size-7" aria-hidden />
            </div>
            <p className="mt-4 text-lg font-semibold">Choose a channel</p>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              Select a channel from the left to jump into the conversation, or create your own.
            </p>
          </div>
        ) : (
          <>
            <header className="flex items-center gap-3 border-b border-border px-4 py-3 sm:px-6">
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 md:hidden"
                onClick={() => {
                  if (loadedFor.current) beaconLeave(loadedFor.current)
                  loadedFor.current = null
                  setActiveChatId(null)
                  setMessages([])
                  router.replace("/app/rooms", { scroll: false })
                }}
                aria-label="Back to channels"
              >
                <ArrowLeft className="size-5" aria-hidden />
              </Button>
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                <Hash className="size-5" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="truncate font-semibold leading-tight">{activeRoom?.name ?? "Channel"}</h1>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Users className="size-3.5" aria-hidden />
                  {members.length > 0 ? `${members.length} online` : "Group channel"}
                </p>
              </div>
            </header>

            <div className="min-h-0 flex-1">
              {loading ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
                </div>
              ) : (
                <ChatRoom
                  key={activeChatId}
                  chatId={activeChatId}
                  currentUserId={me.id}
                  currentUserName={me.name}
                  initialMessages={messages}
                  showSenderNames
                  onUserClick={setPreviewUserId}
                  emptyState={
                    <div className="text-center">
                      <p className="text-sm font-medium">Welcome to #{activeRoom?.name ?? "channel"}</p>
                      <p className="mt-1 text-sm text-muted-foreground">Be the first to say something.</p>
                    </div>
                  }
                />
              )}
            </div>
          </>
        )}
      </main>

      <UserPreviewDialog userId={previewUserId} onClose={() => setPreviewUserId(null)} />
    </div>
  )
}
