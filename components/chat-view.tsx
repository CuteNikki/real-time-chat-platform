"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ChatRoom } from "@/components/chat-room"
import { UserPreviewDialog } from "@/components/user-preview"
import { useChatHeader } from "@/hooks/use-chat-header"
import { endRandomChat } from "@/app/actions/match"
import { reportUser } from "@/app/actions/report"
import type { ChatMessage, ChatType } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ArrowLeft, MoreVertical, Flag, LogOut, Users } from "lucide-react"

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

export function ChatView({
  chatId,
  type,
  title,
  subtitle,
  partnerId,
  ended: initialEnded,
  currentUserId,
  currentUserName,
  initialMessages,
}: {
  chatId: string
  type: ChatType
  title: string
  subtitle: string
  partnerId: string | null
  ended: boolean
  currentUserId: string
  currentUserName: string
  initialMessages: ChatMessage[]
}) {
  const router = useRouter()
  const [ended, setEnded] = useState(initialEnded)
  const [leaving, setLeaving] = useState(false)
  const [previewUserId, setPreviewUserId] = useState<string | null>(null)

  // Live presence count for group rooms.
  const { memberCount } = useChatHeader({ chatId, enabled: type === "GROUP" })

  const isGroup = type === "GROUP"
  const isRandom = type === "RANDOM"

  // Whether we've already ended this random chat (so unmount doesn't re-fire).
  const endedRef = useRef(initialEnded)
  useEffect(() => {
    endedRef.current = ended
  }, [ended])

  // Beacon end for random chats — survives navigation/tab close.
  const beaconEnd = useCallback(() => {
    if (!isRandom || endedRef.current) return
    endedRef.current = true
    const payload = JSON.stringify({ chatId })
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon("/api/match/end", new Blob([payload], { type: "application/json" }))
    } else {
      void fetch("/api/match/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      })
    }
  }, [chatId, isRandom])

  // Auto-end the random match when the user leaves the page or unmounts.
  useEffect(() => {
    if (!isRandom) return
    function handlePageHide() {
      beaconEnd()
    }
    window.addEventListener("pagehide", handlePageHide)
    return () => {
      window.removeEventListener("pagehide", handlePageHide)
      beaconEnd()
    }
  }, [isRandom, beaconEnd])

  async function handleEndChat() {
    setLeaving(true)
    try {
      endedRef.current = true
      await endRandomChat(chatId)
      toast.success("Chat ended")
      router.push("/app")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
      setLeaving(false)
    }
  }

  async function handleReport() {
    try {
      await reportUser({ chatId })
      toast.success("Report submitted. Thanks for keeping Orbit safe.")
    } catch {
      toast.error("Could not submit report")
    }
  }

  // When the partner disconnects, the CHAT_ENDED event flips `ended`.
  function handleEnded() {
    setEnded(true)
    endedRef.current = true
  }

  const canPreview = !isGroup && !!partnerId

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-border bg-background px-4 py-3 sm:px-6">
        <Button variant="ghost" size="icon" className="shrink-0 md:hidden" onClick={() => router.back()} aria-label="Back">
          <ArrowLeft className="size-5" aria-hidden />
        </Button>
        <button
          type="button"
          onClick={() => canPreview && setPreviewUserId(partnerId)}
          disabled={!canPreview}
          className="flex min-w-0 flex-1 items-center gap-3 text-left enabled:hover:opacity-80"
        >
          <Avatar className="size-10 shrink-0">
            <AvatarFallback className="bg-secondary text-sm font-medium text-secondary-foreground">
              {isGroup ? <Users className="size-5" aria-hidden /> : initials(title)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-semibold leading-tight">{title}</h1>
            <div className="flex items-center gap-2">
              <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
              {isGroup && memberCount != null && (
                <Badge variant="secondary" className="h-5 gap-1 px-1.5 text-[11px]">
                  <span className="size-1.5 rounded-full bg-primary" aria-hidden />
                  {memberCount} online
                </Badge>
              )}
              {ended && (
                <Badge variant="outline" className="h-5 px-1.5 text-[11px]">
                  Ended
                </Badge>
              )}
            </div>
          </div>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="ghost" size="icon" className="shrink-0" aria-label="Chat options" />}
          >
            <MoreVertical className="size-5" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {canPreview && (
              <DropdownMenuItem onClick={() => setPreviewUserId(partnerId)}>
                <Users className="size-4" aria-hidden />
                View profile
              </DropdownMenuItem>
            )}
            {!isGroup && (
              <DropdownMenuItem onClick={handleReport}>
                <Flag className="size-4" aria-hidden />
                Report user
              </DropdownMenuItem>
            )}
            {isRandom && (
              <DropdownMenuItem
                onClick={handleEndChat}
                disabled={leaving}
                className="text-destructive focus:text-destructive"
              >
                <LogOut className="size-4" aria-hidden />
                End chat
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Partner-disconnected banner for random chats */}
      {isRandom && ended && (
        <div className="border-b border-border bg-secondary/60 px-4 py-2 text-center text-sm text-secondary-foreground sm:px-6">
          This chat has ended.{" "}
          <button
            type="button"
            onClick={() => router.push("/app")}
            className="font-medium text-primary hover:underline"
          >
            Find a new match
          </button>
        </div>
      )}

      {/* Messages + composer */}
      <div className="min-h-0 flex-1">
        <ChatRoom
          chatId={chatId}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          initialMessages={initialMessages}
          allowImages={type === "PRIVATE"}
          showSenderNames={isGroup}
          onUserClick={isGroup ? setPreviewUserId : undefined}
          onEnded={handleEnded}
        />
      </div>

      <UserPreviewDialog userId={previewUserId} onClose={() => setPreviewUserId(null)} />
    </div>
  )
}
