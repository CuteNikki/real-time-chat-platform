"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { Channel } from "pusher-js"
import { getPusherClient } from "@/lib/pusher/client"
import { chatChannel, EVENTS } from "@/lib/pusher/channels"
import type { ChatMessage } from "@/lib/types"

type PresenceMember = { id: string; info: { name: string } }

export function useChat({
  chatId,
  initialMessages,
  onEnded,
}: {
  chatId: string
  initialMessages: ChatMessage[]
  onEnded?: (payload?: { by?: string; disconnected?: boolean }) => void
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [memberCount, setMemberCount] = useState<number | null>(null)
  const [ended, setEnded] = useState(false)
  const channelRef = useRef<Channel | null>(null)

  useEffect(() => {
    setMessages(initialMessages)
  }, [initialMessages])

  useEffect(() => {
    const pusher = getPusherClient()
    const channel = pusher.subscribe(chatChannel(chatId))
    channelRef.current = channel

    const handleNew = (msg: ChatMessage) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev
        return [...prev, msg]
      })
    }

    const handleEnded = (payload?: { by?: string; disconnected?: boolean }) => {
      setEnded(true)
      onEnded?.(payload)
    }

    const handleCleared = () => {
      setMessages([])
    }

    const recount = () => {
      // @ts-expect-error members exists on presence channels
      const members = channel.members
      if (members) setMemberCount(members.count)
    }

    channel.bind(EVENTS.NEW_MESSAGE, handleNew)
    channel.bind(EVENTS.CHAT_ENDED, handleEnded)
    channel.bind(EVENTS.CHAT_CLEARED, handleCleared)
    channel.bind("pusher:subscription_succeeded", recount)
    channel.bind("pusher:member_added", recount)
    channel.bind("pusher:member_removed", recount)

    return () => {
      channel.unbind(EVENTS.NEW_MESSAGE, handleNew)
      channel.unbind(EVENTS.CHAT_ENDED, handleEnded)
      channel.unbind(EVENTS.CHAT_CLEARED, handleCleared)
      channel.unbind("pusher:subscription_succeeded", recount)
      channel.unbind("pusher:member_added", recount)
      channel.unbind("pusher:member_removed", recount)
      pusher.unsubscribe(chatChannel(chatId))
      channelRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId])

  // Optimistically append a locally-sent message (deduped by id when the
  // realtime echo arrives).
  const appendLocal = useCallback((msg: ChatMessage) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev
      return [...prev, msg]
    })
  }, [])

  return { messages, memberCount, ended, appendLocal }
}

export type { PresenceMember }
