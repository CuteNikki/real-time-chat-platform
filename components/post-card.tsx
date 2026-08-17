"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Heart, MoreHorizontal, Pencil, Trash2, Loader2 } from "lucide-react"
import { UserAvatar } from "@/components/user-avatar"
import { PostLikersDialog } from "@/components/post-likers-dialog"
import { LocalTime } from "@/components/local-time"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { buttonVariants } from "@/components/ui/button"
import { toggleLike, updatePost, deletePost } from "@/app/actions/posts"
import { cn } from "@/lib/utils"
import type { PostSummary } from "@/lib/types"

export function PostCard({
  post,
  onDeleted,
  onUpdated,
}: {
  post: PostSummary
  // Optional hooks so a parent list (e.g. the profile grid) can react without a
  // full refresh. When omitted, the card refreshes the route itself.
  onDeleted?: (id: string) => void
  onUpdated?: (id: string, caption: string | null) => void
}) {
  const router = useRouter()
  const [liked, setLiked] = useState(post.likedByMe)
  const [count, setCount] = useState(post.likeCount)
  const [pending, setPending] = useState(false)

  const [caption, setCaption] = useState(post.caption)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(post.caption ?? "")
  const [saving, setSaving] = useState(false)

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [removed, setRemoved] = useState(false)

  async function toggle() {
    if (pending) return
    const next = !liked
    setLiked(next)
    setCount((c) => c + (next ? 1 : -1))
    setPending(true)
    try {
      const res = await toggleLike(post.id)
      setLiked((prev) => {
        if (prev !== res.liked) setCount((c) => c + (res.liked ? 1 : -1))
        return res.liked
      })
    } catch {
      setLiked(!next)
      setCount((c) => c + (next ? -1 : 1))
    } finally {
      setPending(false)
    }
  }

  async function saveEdit() {
    if (saving) return
    setSaving(true)
    try {
      const res = await updatePost(post.id, draft)
      setCaption(res.caption)
      setEditing(false)
      onUpdated?.(post.id, res.caption)
      toast.success("Post updated")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update post")
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (deleting) return
    setDeleting(true)
    try {
      await deletePost(post.id)
      setConfirmOpen(false)
      setRemoved(true)
      if (onDeleted) onDeleted(post.id)
      else router.refresh()
      toast.success("Post deleted")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete post")
      setDeleting(false)
    }
  }

  if (removed && !onDeleted) return null

  const profileHref = post.authorUsername ? `/app/u/${post.authorUsername}` : "#"
  const displayName = post.authorName || "Unknown"

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card">
      <header className="flex items-center gap-3 p-3">
        <Link href={profileHref} className="shrink-0">
          <UserAvatar name={displayName} image={post.authorImage} className="size-10" />
        </Link>
        <div className="flex min-w-0 flex-col leading-tight">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
            <Link href={profileHref} className="truncate text-sm font-semibold hover:underline">
              {displayName}
            </Link>
            {post.authorUsername ? (
              <Link
                href={profileHref}
                className="truncate text-xs text-muted-foreground hover:underline"
              >
                @{post.authorUsername}
              </Link>
            ) : null}
          </div>
          <LocalTime iso={post.createdAt} className="text-xs text-muted-foreground" />
        </div>

        {post.canManage ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Post options"
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon" }),
                "ml-auto size-8 shrink-0 text-muted-foreground",
              )}
            >
              <MoreHorizontal className="size-5" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem
                className="gap-2"
                onClick={() => {
                  setDraft(caption ?? "")
                  setEditing(true)
                }}
              >
                <Pencil className="size-4" aria-hidden />
                Edit caption
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                className="gap-2"
                onClick={() => setConfirmOpen(true)}
              >
                <Trash2 className="size-4" aria-hidden />
                Delete post
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </header>

      {post.imageUrl ? (
        <div className="relative aspect-square w-full bg-muted">
          {/* Blob image; unoptimized to avoid remote-loader config. */}
          <img
            src={post.imageUrl || "/placeholder.svg"}
            alt={caption ? `Post: ${caption}` : "Post image"}
            className="h-full w-full object-cover"
          />
        </div>
      ) : null}

      <div className="flex flex-col gap-2 p-3">
        {/* Text-only posts: caption sits above the like row and drops the name
            prefix (the author is already shown in the header). */}
        {!editing && !post.imageUrl && caption ? (
          <p className="text-pretty text-sm leading-relaxed">{caption}</p>
        ) : null}

        <div className="flex w-fit items-center gap-1">
          <button
            type="button"
            onClick={toggle}
            className="flex items-center rounded-full p-0.5"
            aria-pressed={liked}
            aria-label={liked ? "Unlike" : "Like"}
          >
            <Heart
              className={cn(
                "size-6 transition-colors",
                liked ? "fill-primary text-primary" : "text-foreground",
              )}
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
                {count} {count === 1 ? "like" : "likes"}
              </button>
            </PostLikersDialog>
          ) : (
            <span className="px-1 text-sm font-medium tabular-nums text-muted-foreground">
              No likes yet
            </span>
          )}
        </div>

        {editing ? (
          <div className="flex flex-col gap-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Write a caption..."
              aria-label="Edit caption"
              className="resize-none"
            />
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={saving}
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
              <Button type="button" size="sm" disabled={saving} onClick={saveEdit}>
                {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : "Save"}
              </Button>
            </div>
          </div>
        ) : post.imageUrl && caption ? (
          // Image posts keep the classic "name caption" line below the like row.
          <p className="text-sm leading-relaxed">
            <Link href={profileHref} className="font-semibold hover:underline">
              {displayName}
            </Link>{" "}
            {caption}
          </p>
        ) : null}
      </div>

      <Dialog open={confirmOpen} onOpenChange={(o) => !deleting && setConfirmOpen(o)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this post?</DialogTitle>
            <DialogDescription>
              This permanently removes the post and its likes. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" disabled={deleting} onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={deleting} onClick={confirmDelete}>
              {deleting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  )
}
