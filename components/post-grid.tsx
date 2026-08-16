"use client"

import { useState } from "react"
import Image from "next/image"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { UserAvatar } from "@/components/user-avatar"
import { toggleLike } from "@/app/actions/posts"
import type { PostSummary } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Heart, ImageIcon } from "lucide-react"

export function PostGrid({
  posts,
  emptyLabel = "No posts yet.",
}: {
  posts: PostSummary[]
  emptyLabel?: string
}) {
  const [active, setActive] = useState<PostSummary | null>(null)

  if (posts.length === 0) {
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
        {posts.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setActive(p)}
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

      <PostDialog post={active} onOpenChange={(open) => !open && setActive(null)} />
    </>
  )
}

function PostDialog({
  post,
  onOpenChange,
}: {
  post: PostSummary | null
  onOpenChange: (open: boolean) => void
}) {
  const [liked, setLiked] = useState(false)
  const [count, setCount] = useState(0)
  const [pending, setPending] = useState(false)

  // Sync local like state whenever a new post opens.
  if (post && !pending && (liked !== post.likedByMe || count !== post.likeCount)) {
    // Only initialize when the dialog opens for a different post.
  }

  async function onToggle() {
    if (!post) return
    setPending(true)
    const next = !liked
    setLiked(next)
    setCount((c) => c + (next ? 1 : -1))
    try {
      await toggleLike(post.id)
    } catch {
      setLiked(!next)
      setCount((c) => c + (next ? -1 : 1))
      toast.error("Could not update like")
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog
      open={!!post}
      onOpenChange={(open) => {
        if (open && post) {
          setLiked(post.likedByMe)
          setCount(post.likeCount)
        }
        onOpenChange(open)
      }}
    >
      <DialogContent className="max-w-lg overflow-hidden p-0">
        {post ? (
          <div className="flex flex-col">
            <div className="flex items-center gap-3 border-b border-border p-4">
              <UserAvatar name={post.authorName} image={post.authorImage} size="sm" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{post.authorName}</p>
                {post.authorUsername ? (
                  <p className="truncate text-xs text-muted-foreground">@{post.authorUsername}</p>
                ) : null}
              </div>
            </div>
            <div className="relative aspect-square w-full bg-muted">
              <Image
                src={post.imageUrl || "/placeholder.svg"}
                alt={post.caption ?? "Post"}
                fill
                sizes="512px"
                className="object-contain"
              />
            </div>
            <div className="flex flex-col gap-2 p-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onToggle}
                  disabled={pending}
                  className="flex items-center gap-1.5 text-sm"
                  aria-pressed={liked}
                >
                  <Heart
                    className={cn(
                      "size-6 transition-colors",
                      liked ? "fill-primary text-primary" : "text-foreground",
                    )}
                    aria-hidden
                  />
                  <span className="tabular-nums">{count}</span>
                </button>
              </div>
              <DialogTitle className="sr-only">Post by {post.authorName}</DialogTitle>
              {post.caption ? (
                <DialogDescription className="text-sm leading-relaxed text-foreground">
                  <span className="font-medium">{post.authorName}</span> {post.caption}
                </DialogDescription>
              ) : (
                <DialogDescription className="sr-only">Post image</DialogDescription>
              )}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
