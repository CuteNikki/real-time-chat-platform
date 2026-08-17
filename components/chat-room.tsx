"use client"

import type React from "react"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { useChat } from "@/hooks/use-chat"
import { sendMessage } from "@/app/actions/chat"
import { newId } from "@/lib/id"
import { cn } from "@/lib/utils"
import type { ChatMessage } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ImagePlus, SendHorizonal, X, Loader2 } from "lucide-react"

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

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

export function ChatRoom({
  chatId,
  currentUserId,
  currentUserName,
  initialMessages,
  allowImages = false,
  showSenderNames = false,
  onEnded,
  emptyState,
  onUserClick,
}: {
  chatId: string
  currentUserId: string
  currentUserName: string
  initialMessages: ChatMessage[]
  allowImages?: boolean
  showSenderNames?: boolean
  onEnded?: (payload?: { by?: string; disconnected?: boolean }) => void
  emptyState?: React.ReactNode
  // When provided, tapping another user's avatar or name opens their preview.
  onUserClick?: (userId: string) => void
}) {
  const { messages, ended, appendLocal } = useChat({ chatId, initialMessages, onEnded })
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [pendingImage, setPendingImage] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length])

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("Only image files are allowed")
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image must be under 8MB")
      return
    }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/upload", { method: "POST", body: fd })
      if (!res.ok) throw new Error("Upload failed")
      const { url } = await res.json()
      setPendingImage(url)
    } catch {
      toast.error("Could not upload image")
    } finally {
      setUploading(false)
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const content = text.trim()
    if ((!content && !pendingImage) || sending || ended) return

    // Optimistic message. The client-generated id is passed to the server so
    // the saved row and realtime echo reuse it, keeping a single deduped copy.
    const clientId = newId("msg")
    const optimistic: ChatMessage = {
      id: clientId,
      chatId,
      senderId: currentUserId,
      senderName: currentUserName,
      content: content || null,
      imageUrl: pendingImage,
      createdAt: new Date().toISOString(),
    }
    appendLocal(optimistic)
    setText("")
    const imageUrl = pendingImage
    setPendingImage(null)
    setSending(true)
    try {
      await sendMessage({ chatId, content, imageUrl: imageUrl ?? undefined, clientId })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Message failed to send")
    } finally {
      setSending(false)
    }
  }

  const isEmpty = messages.length === 0

  return (
    <div className="flex h-full flex-col">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        {isEmpty ? (
          <div className="flex h-full items-center justify-center">
            {emptyState ?? <p className="text-sm text-muted-foreground">No messages yet. Say hello!</p>}
          </div>
        ) : (
          <ul className="flex flex-col gap-4">
            {messages.map((m) => {
              const mine = m.senderId === currentUserId
              return (
                <li key={m.id} className={cn("flex gap-3", mine && "flex-row-reverse")}>
                  {!mine &&
                    (onUserClick ? (
                      <button
                        type="button"
                        onClick={() => onUserClick(m.senderId)}
                        className="mt-1 shrink-0 rounded-full outline-none ring-ring transition-opacity hover:opacity-80 focus-visible:ring-2"
                        aria-label={`View ${m.senderName}'s profile`}
                      >
                        <Avatar className="size-8">
                          <AvatarFallback className="bg-secondary text-xs font-medium text-secondary-foreground">
                            {initials(m.senderName)}
                          </AvatarFallback>
                        </Avatar>
                      </button>
                    ) : (
                      <Avatar className="mt-1 size-8 shrink-0">
                        <AvatarFallback className="bg-secondary text-xs font-medium text-secondary-foreground">
                          {initials(m.senderName)}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                  <div className={cn("flex max-w-[75%] flex-col gap-1", mine && "items-end")}>
                    {showSenderNames &&
                      !mine &&
                      (onUserClick ? (
                        <button
                          type="button"
                          onClick={() => onUserClick(m.senderId)}
                          className="self-start px-1 text-left text-xs font-medium text-muted-foreground hover:underline"
                        >
                          {m.senderName}
                        </button>
                      ) : (
                        <span className="px-1 text-xs font-medium text-muted-foreground">{m.senderName}</span>
                      ))}
                    <div
                      className={cn(
                        "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                        mine
                          ? "rounded-br-sm bg-primary text-primary-foreground"
                          : "rounded-bl-sm bg-secondary text-secondary-foreground",
                      )}
                    >
                      {m.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={m.imageUrl || "/placeholder.svg"}
                          alt="Shared image"
                          className="mb-1 max-h-72 rounded-lg object-cover"
                        />
                      )}
                      {m.content && <p className="whitespace-pre-wrap break-words">{m.content}</p>}
                    </div>
                    <span className="px-1 text-[11px] text-muted-foreground" suppressHydrationWarning>
                    {timeLabel(m.createdAt)}
                  </span>
                  </div>
                </li>
              )
            })}
            <div ref={bottomRef} />
          </ul>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-border bg-background px-4 py-3 sm:px-6">
        <div className="w-full">
          {pendingImage && (
            <div className="relative mb-2 inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={pendingImage || "/placeholder.svg"}
                alt="Pending upload preview"
                className="max-h-28 rounded-lg border border-border object-cover"
              />
              <button
                type="button"
                onClick={() => setPendingImage(null)}
                className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full bg-foreground text-background"
                aria-label="Remove image"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </div>
          )}
          {ended ? (
            <p className="py-2 text-center text-sm text-muted-foreground">This conversation has ended.</p>
          ) : (
            <form onSubmit={submit} className="flex items-end gap-2">
              {allowImages && (
                <>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-11 shrink-0 bg-transparent"
                    disabled={uploading}
                    onClick={() => fileRef.current?.click()}
                    aria-label="Attach image"
                  >
                    {uploading ? (
                      <Loader2 className="size-5 animate-spin" aria-hidden />
                    ) : (
                      <ImagePlus className="size-5" aria-hidden />
                    )}
                  </Button>
                </>
              )}
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    if ((e.nativeEvent as any).isComposing || (e as any).keyCode === 229) return
                    e.preventDefault()
                    submit(e as unknown as React.FormEvent)
                  }
                }}
                rows={1}
                placeholder="Type a message…"
                className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-input bg-card px-4 py-3 text-sm outline-none ring-ring focus-visible:ring-2"
              />
              <Button
                type="submit"
                size="icon"
                className="size-11 shrink-0"
                disabled={sending || (!text.trim() && !pendingImage)}
                aria-label="Send message"
              >
                <SendHorizonal className="size-5" aria-hidden />
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
