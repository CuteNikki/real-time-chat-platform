"use client"

import { useState } from "react"
import Link from "next/link"
import { Heart } from "lucide-react"
import { UserAvatar } from "@/components/user-avatar"
import { PostLikersDialog } from "@/components/post-likers-dialog"
import { toggleLike } from "@/app/actions/posts"
import { cn } from "@/lib/utils"
import type { PostSummary } from "@/lib/types"

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return "just now"
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d`
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

export function PostCard({ post }: { post: PostSummary }) {
  const [liked, setLiked] = useState(post.likedByMe)
  const [count, setCount] = useState(post.likeCount)
  const [pending, setPending] = useState(false)

  async function toggle() {
    if (pending) return
    // Optimistic update.
    const next = !liked
    setLiked(next)
    setCount((c) => c + (next ? 1 : -1))
    setPending(true)
    try {
      const res = await toggleLike(post.id)
      // Reconcile with the server's canonical liked state; if it disagrees with
      // our optimistic guess, correct the count by one.
      setLiked((prev) => {
        if (prev !== res.liked) setCount((c) => c + (res.liked ? 1 : -1))
        return res.liked
      })
    } catch {
      // Revert on failure.
      setLiked(!next)
      setCount((c) => c + (next ? -1 : 1))
    } finally {
      setPending(false)
    }
  }

  const profileHref = post.authorUsername ? `/app/u/${post.authorUsername}` : "#"

  return (
    <article className="overflow-hidden rounded-xl border border-border bg-card">
      <header className="flex items-center gap-3 p-3">
        <Link href={profileHref}>
          <UserAvatar name={post.authorName} image={post.authorImage} className="size-9" />
        </Link>
        <div className="flex flex-col leading-tight">
          <Link href={profileHref} className="text-sm font-semibold hover:underline">
            {post.authorUsername ? `@${post.authorUsername}` : post.authorName}
          </Link>
          <span className="text-xs text-muted-foreground" suppressHydrationWarning>
            {timeAgo(post.createdAt)}
          </span>
        </div>
      </header>

      <div className="relative aspect-square w-full bg-muted">
        {/* Blob image; unoptimized to avoid remote-loader config. */}
        <img
          src={post.imageUrl || "/placeholder.svg"}
          alt={post.caption ? `Post: ${post.caption}` : "Post image"}
          className="h-full w-full object-cover"
        />
      </div>

      <div className="flex flex-col gap-2 p-3">
        <div className="flex w-fit items-center gap-1">
          <button
            type="button"
            onClick={toggle}
            className="flex items-center rounded-full p-0.5"
            aria-pressed={liked}
            aria-label={liked ? "Unlike" : "Like"}
          >
            <Heart
              className={cn("size-6 transition-colors", liked ? "fill-primary text-primary" : "text-foreground")}
              aria-hidden
            />
          </button>
          {count > 0 ? (
            <PostLikersDialog postId={post.id} count={count}>
              <button
                type="button"
                className="rounded px-1 text-sm font-medium tabular-nums hover:underline"
                aria-label={`See who liked this post (${count})`}
              >
                {count}
              </button>
            </PostLikersDialog>
          ) : (
            <span className="px-1 text-sm font-medium tabular-nums text-muted-foreground">{count}</span>
          )}
        </div>
        {post.caption ? (
          <p className="text-sm leading-relaxed">
            <Link href={profileHref} className="font-semibold hover:underline">
              {post.authorUsername ? `@${post.authorUsername}` : post.authorName}
            </Link>{" "}
            {post.caption}
          </p>
        ) : null}
      </div>
    </article>
  )
}
