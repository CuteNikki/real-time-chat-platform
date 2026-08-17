"use client"

import { useState } from "react"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { UserAvatar } from "@/components/user-avatar"
import { getPostLikers } from "@/app/actions/posts"
import type { PostLiker } from "@/lib/types"

export function PostLikersDialog({
  postId,
  count,
  children,
}: {
  postId: string
  count: number
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [likers, setLikers] = useState<PostLiker[]>([])
  const [loading, setLoading] = useState(false)

  async function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) {
      setLoading(true)
      try {
        setLikers(await getPostLikers(postId))
      } catch {
        setLikers([])
      } finally {
        setLoading(false)
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={children as React.ReactElement} />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {count === 1 ? "1 like" : `${count} likes`}
          </DialogTitle>
        </DialogHeader>
        <div className="-mx-1 max-h-80 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
            </div>
          ) : likers.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No likes yet.</p>
          ) : (
            <ul className="flex flex-col">
              {likers.map((u) => {
                const href = u.username ? `/app/u/${u.username}` : "#"
                return (
                  <li key={u.id}>
                    <Link
                      href={href}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 rounded-lg px-1 py-2 transition-colors hover:bg-secondary"
                    >
                      <UserAvatar name={u.name} image={u.image} className="size-9" />
                      <div className="min-w-0 leading-tight">
                        <p className="truncate text-sm font-medium">{u.name}</p>
                        {u.username ? (
                          <p className="truncate text-xs text-muted-foreground">@{u.username}</p>
                        ) : null}
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
