"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { PostCard } from "@/components/post-card"
import type { PostSummary } from "@/lib/types"
import { ImageIcon } from "lucide-react"

export function PostGrid({
  posts,
  emptyLabel = "No posts yet.",
}: {
  posts: PostSummary[]
  emptyLabel?: string
}) {
  // Keep a local copy so edits/deletes reflect immediately without a refetch.
  const [items, setItems] = useState<PostSummary[]>(posts)
  const [activeId, setActiveId] = useState<string | null>(null)

  // Re-sync if the server sends a new list (e.g. after navigation/refresh).
  useEffect(() => {
    setItems(posts)
  }, [posts])

  const active = items.find((p) => p.id === activeId) ?? null

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-muted">
          <ImageIcon className="size-6 text-muted-foreground" aria-hidden />
        </div>
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-1 sm:gap-2">
        {items.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setActiveId(p.id)}
            className="group relative aspect-square overflow-hidden rounded-md bg-muted"
          >
            <Image
              src={p.imageUrl || "/placeholder.svg"}
              alt={p.caption ?? "Post"}
              fill
              sizes="(max-width: 640px) 33vw, 300px"
              className="object-cover transition-transform group-hover:scale-105"
            />
          </button>
        ))}
      </div>

      <Dialog open={!!active} onOpenChange={(open) => !open && setActiveId(null)}>
        <DialogContent
          showCloseButton={false}
          className="border-0 bg-transparent p-0 ring-0 sm:max-w-md"
        >
          <DialogTitle className="sr-only">
            {active ? `Post by ${active.authorName}` : "Post"}
          </DialogTitle>
          {active ? (
            <div className="max-h-[85vh] overflow-y-auto">
              <PostCard
                post={active}
                onDeleted={(id) => {
                  setActiveId(null)
                  setItems((prev) => prev.filter((p) => p.id !== id))
                }}
                onUpdated={(id, caption) =>
                  setItems((prev) => prev.map((p) => (p.id === id ? { ...p, caption } : p)))
                }
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
