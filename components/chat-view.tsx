"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ChatRoom } from "@/components/chat-room"
import { useChatHeader } from "@/hooks/use-chat-header"
import { endRandomChat } from "@/app/actions/match"
import { leaveRoom } from "@/app/actions/rooms"
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
  ended: initialEnded,
  currentUserId,
  currentUserName,
  initialMessages,
}: {
  chatId: string
  type: ChatType
  title: string
  subtitle: string
  ended: boolean
  currentUserId: string
  currentUserName: string
  initialMessages: ChatMessage[]
}) {
  const router = useRouter()
  const [ended, setEnded] = useState(initialEnded)
  const [leaving, setLeaving] = useState(false)

  // Live presence count for group rooms.
  const { memberCount } = useChatHeader({ chatId, enabled: type === "GROUP" })

  const isGroup = type === "GROUP"

  async function handleEndOrLeave() {
    setLeaving(true)
    try {
      if (isGroup) {
        await leaveRoom(chatId)
        toast.success("You left the room")
        router.push("/app/rooms")
      } else {
        await endRandomChat(chatId)
        toast.success("Chat ended")
        router.push(type === "RANDOM" ? "/app" : "/app/private")
      }
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

  return (
    <div className="flex h-[calc(100svh-4rem)] flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-border bg-background px-4 py-3 sm:px-6">
        <Button variant="ghost" size="icon" className="shrink-0 md:hidden" onClick={() => router.back()} aria-label="Back">
          <ArrowLeft className="size-5" aria-hidden />
        </Button>
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

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="shrink-0" aria-label="Chat options">
              <MoreVertical className="size-5" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {!isGroup && (
              <DropdownMenuItem onClick={handleReport}>
                <Flag className="size-4" aria-hidden />
                Report user
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={handleEndOrLeave}
              disabled={leaving}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="size-4" aria-hidden />
              {isGroup ? "Leave room" : "End chat"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Messages + composer */}
      <div className="min-h-0 flex-1">
        <ChatRoom
          chatId={chatId}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          initialMessages={initialMessages}
          allowImages={type === "PRIVATE"}
          showSenderNames={isGroup}
          onEnded={() => setEnded(true)}
        />
      </div>
    </div>
  )
}
