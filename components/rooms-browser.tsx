"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { toast } from "sonner"
import { createRoom, joinRoom } from "@/app/actions/rooms"
import type { RoomSummary } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Users, Plus, ArrowRight } from "lucide-react"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function RoomsBrowser({ initialRooms }: { initialRooms: RoomSummary[] }) {
  const router = useRouter()
  const { data: rooms = initialRooms, mutate } = useSWR<RoomSummary[]>("/api/rooms", fetcher, {
    fallbackData: initialRooms,
    refreshInterval: 5000,
  })

  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [creating, setCreating] = useState(false)
  const [joiningId, setJoiningId] = useState<string | null>(null)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || creating) return
    setCreating(true)
    try {
      const { chatId } = await createRoom(name)
      setOpen(false)
      setName("")
      router.push(`/app/chat/${chatId}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create room")
      setCreating(false)
    }
  }

  async function handleJoin(chatId: string) {
    setJoiningId(chatId)
    try {
      await joinRoom(chatId)
      router.push(`/app/chat/${chatId}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not join room")
      setJoiningId(null)
      mutate()
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Group rooms</h1>
          <p className="mt-1 text-sm text-muted-foreground">Jump into an open room or start your own.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button className="gap-2" />}>
            <Plus className="size-4" aria-hidden />
            <span className="hidden sm:inline">New room</span>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleCreate}>
              <DialogHeader>
                <DialogTitle>Create a room</DialogTitle>
                <DialogDescription>Give your room a name. Anyone can find and join it.</DialogDescription>
              </DialogHeader>
              <div className="my-5 flex flex-col gap-2">
                <Label htmlFor="room-name">Room name</Label>
                <Input
                  id="room-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Late night talks"
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

      <div className="mt-8">
        {rooms.length === 0 ? (
          <div className="flex flex-col items-center rounded-xl border border-dashed border-border py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <Users className="size-6" aria-hidden />
            </div>
            <p className="mt-4 font-medium">No rooms yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Be the first to start a conversation.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {rooms.map((room) => (
              <li
                key={room.id}
                className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
              >
                <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <Users className="size-5" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{room.name}</p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <Badge variant="secondary" className="h-5 gap-1 px-1.5 text-[11px]">
                      <span className="size-1.5 rounded-full bg-primary" aria-hidden />
                      {room.memberCount} {room.memberCount === 1 ? "person" : "people"}
                    </Badge>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="shrink-0 gap-1.5 bg-transparent"
                  onClick={() => handleJoin(room.id)}
                  disabled={joiningId === room.id}
                >
                  {joiningId === room.id ? "Joining…" : "Join"}
                  <ArrowRight className="size-4" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
