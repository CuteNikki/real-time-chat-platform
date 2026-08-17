"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { MessageCircle, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { UserAvatar } from "@/components/user-avatar"
import { ChatRoom } from "@/components/chat-room"
import { UserPreviewDialog } from "@/components/user-preview"
import { getMessages } from "@/app/actions/chat"
import { cn } from "@/lib/utils"
import type { ChatMessage } from "@/lib/types"
import type { PrivateConversation } from "@/app/actions/invites"

export function MessagesWorkspace({
  currentUserId,
  currentUserName,
  conversations,
  initialChatId,
}: {
  currentUserId: string
  currentUserName: string
  conversations: PrivateConversation[]
  initialChatId: string | null
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [activeId, setActiveId] = useState<string | null>(
    initialChatId && conversations.some((c) => c.chatId === initialChatId)
      ? initialChatId
      : (conversations[0]?.chatId ?? null),
  )
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState("")
  const [previewUserId, setPreviewUserId] = useState<string | null>(null)

  // Keep the URL in sync so refresh/deep-link works.
  useEffect(() => {
    const current = searchParams.get("c")
    if (activeId && activeId !== current) {
      router.replace(`/app/messages?c=${activeId}`, { scroll: false })
    }
  }, [activeId, router, searchParams])

  // Load messages when the active conversation changes.
  useEffect(() => {
    if (!activeId) {
      setMessages([])
      return
    }
    let cancelled = false
    setLoading(true)
    getMessages(activeId)
      .then((m) => {
        if (!cancelled) setMessages(m)
      })
      .catch(() => {
        if (!cancelled) setMessages([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [activeId])

  const active = conversations.find((c) => c.chatId === activeId) ?? null

  const filtered = conversations.filter((c) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return (
      c.partnerName.toLowerCase().includes(q) ||
      (c.partnerUsername ?? "").toLowerCase().includes(q)
    )
  })

  return (
    <div className="flex h-full w-full">
      {/* Conversation list */}
      <aside
        className={cn(
          "flex w-full shrink-0 flex-col border-r border-border sm:w-80",
          active && "hidden sm:flex",
        )}
      >
        <div className="border-b border-border p-3">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search conversations"
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-sm text-muted-foreground text-balance">
                No conversations yet. Add friends and start chatting.
              </p>
              <Link
                href="/app/friends"
                className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
              >
                Find friends
              </Link>
            </div>
          ) : (
            <ul>
              {filtered.map((c) => {
                const isActive = c.chatId === activeId
                return (
                  <li key={c.chatId}>
                    <button
                      type="button"
                      onClick={() => setActiveId(c.chatId)}
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-3 text-left transition-colors",
                        isActive ? "bg-secondary" : "hover:bg-muted",
                      )}
                    >
                      <UserAvatar name={c.partnerName} image={c.partnerImage} className="size-11 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium leading-tight">{c.partnerName}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {c.lastMessage
                            ? `${c.lastFromMe ? "You: " : ""}${c.lastMessage}`
                            : "No messages yet"}
                        </p>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </aside>

      {/* Active conversation */}
      <section className={cn("flex min-w-0 flex-1 flex-col", !active && "hidden sm:flex")}>
        {active ? (
          <>
            <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-4">
              <button
                type="button"
                onClick={() => setActiveId(null)}
                className="text-sm text-muted-foreground sm:hidden"
                aria-label="Back to conversations"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => active.partnerId && setPreviewUserId(active.partnerId)}
                className="flex items-center gap-3 text-left hover:opacity-80"
              >
                <UserAvatar name={active.partnerName} image={active.partnerImage} className="size-9" />
                <div className="leading-tight">
                  <p className="font-semibold">{active.partnerName}</p>
                  {active.partnerUsername ? (
                    <p className="text-xs text-muted-foreground">@{active.partnerUsername}</p>
                  ) : null}
                </div>
              </button>
            </header>

            <div className="min-h-0 flex-1">
              {loading ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-sm text-muted-foreground">Loading messages…</p>
                </div>
              ) : (
                <ChatRoom
                  key={active.chatId}
                  chatId={active.chatId}
                  currentUserId={currentUserId}
                  currentUserName={currentUserName}
                  initialMessages={messages}
                  allowImages
                  onUserClick={setPreviewUserId}
                  emptyState={
                    <p className="text-sm text-muted-foreground text-balance">
                      This is the start of your conversation with {active.partnerName}. Say hello!
                    </p>
                  }
                />
              )}
            </div>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-secondary">
              <MessageCircle className="size-7 text-secondary-foreground" aria-hidden />
            </div>
            <p className="text-sm text-muted-foreground text-balance">
              Select a conversation to start chatting.
            </p>
          </div>
        )}
      </section>

      <UserPreviewDialog userId={previewUserId} onClose={() => setPreviewUserId(null)} />
    </div>
  )
}
