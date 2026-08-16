"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { requestMatch, cancelMatch, checkMatchStatus } from "@/app/actions/match"
import { getPusherClient } from "@/lib/pusher/client"
import { userChannel, EVENTS } from "@/lib/pusher/channels"
import { Button } from "@/components/ui/button"
import { Shuffle, Loader2, Sparkles } from "lucide-react"

export function MatchFinder({ userId }: { userId: string }) {
  const router = useRouter()
  const [status, setStatus] = useState<"idle" | "searching" | "matched">("idle")
  const [busy, setBusy] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const goToChat = useCallback(
    (chatId: string, partnerName?: string) => {
      setStatus("matched")
      if (partnerName) toast.success(`Matched with ${partnerName}!`)
      router.push(`/app/chat/${chatId}`)
    },
    [router],
  )

  // Realtime: partner-side match notification.
  useEffect(() => {
    const pusher = getPusherClient()
    const channel = pusher.subscribe(userChannel(userId))
    const onMatch = (data: { chatId: string; partnerName: string }) => {
      goToChat(data.chatId, data.partnerName)
    }
    channel.bind(EVENTS.MATCH_FOUND, onMatch)
    return () => {
      channel.unbind(EVENTS.MATCH_FOUND, onMatch)
      pusher.unsubscribe(userChannel(userId))
    }
  }, [userId, goToChat])

  // Poll fallback while searching.
  useEffect(() => {
    if (status !== "searching") {
      if (pollRef.current) clearInterval(pollRef.current)
      return
    }
    pollRef.current = setInterval(async () => {
      try {
        const res = await checkMatchStatus()
        if (res.status === "matched") goToChat(res.chatId)
      } catch {
        // ignore transient errors
      }
    }, 3000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [status, goToChat])

  // Clean up the queue if the user leaves the page while searching.
  useEffect(() => {
    return () => {
      if (status === "searching") cancelMatch().catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function start() {
    setBusy(true)
    try {
      const res = await requestMatch()
      if (res.status === "matched") {
        goToChat(res.chatId, res.partnerName)
      } else {
        setStatus("searching")
      }
    } catch {
      toast.error("Could not start matching. Try again.")
    } finally {
      setBusy(false)
    }
  }

  async function stop() {
    setBusy(true)
    try {
      await cancelMatch()
      setStatus("idle")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-lg flex-col items-center justify-center px-6 py-12 text-center">
      <div className="relative mb-8 flex size-28 items-center justify-center rounded-full bg-accent">
        {status === "searching" ? (
          <>
            <span className="absolute inline-flex size-28 animate-ping rounded-full bg-primary/20" />
            <Loader2 className="size-12 animate-spin text-primary" aria-hidden />
          </>
        ) : (
          <Shuffle className="size-12 text-primary" aria-hidden />
        )}
      </div>

      {status === "searching" ? (
        <>
          <h1 className="text-2xl font-semibold tracking-tight">Finding someone for you…</h1>
          <p className="mt-2 max-w-sm text-pretty text-muted-foreground">
            Hang tight — we&apos;ll drop you into a chat the moment we find a match.
          </p>
          <Button variant="outline" size="lg" className="mt-8 bg-transparent" onClick={stop} disabled={busy}>
            Cancel
          </Button>
        </>
      ) : (
        <>
          <h1 className="text-3xl font-semibold tracking-tight text-balance">Meet someone new</h1>
          <p className="mt-3 max-w-sm text-pretty text-muted-foreground">
            Tap below and we&apos;ll pair you one-on-one with another person who&apos;s ready to chat right now.
          </p>
          <Button size="lg" className="mt-8 h-12 gap-2 px-8 text-base" onClick={start} disabled={busy}>
            <Sparkles className="size-5" aria-hidden />
            {busy ? "Starting…" : "Find a match"}
          </Button>
        </>
      )}
    </div>
  )
}
