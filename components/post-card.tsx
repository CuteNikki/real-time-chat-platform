'use client';

import { deletePost, toggleLike, updatePost } from '@/app/actions/posts';
import { LocalTime } from '@/components/local-time';
import { PostLikersDialog } from '@/components/post-likers-dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { UserAvatar } from '@/components/user-avatar';
import type { PostSummary } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Heart, Loader2, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

export function PostCard({
  post,
  onDeletedAction,
  onUpdatedAction,
}: {
  post: PostSummary;
  onDeletedAction?: (id: string) => void;
  onUpdatedAction?: (id: string, caption: string | null) => void;
}) {
  const router = useRouter();
  const [liked, setLiked] = useState(post.likedByMe);
  const [count, setCount] = useState(post.likeCount);
  const [pending, setPending] = useState(false);

  const [caption, setCaption] = useState(post.caption);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.caption ?? '');
  const [saving, setSaving] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [removed, setRemoved] = useState(false);

  async function toggle() {
    if (pending) return;
    const next = !liked;
    setLiked(next);
    setCount((c) => c + (next ? 1 : -1));
    setPending(true);
    try {
      const res = await toggleLike(post.id);
      setLiked((prev) => {
        if (prev !== res.liked) setCount((c) => c + (res.liked ? 1 : -1));
        return res.liked;
      });
    } catch {
      setLiked(!next);
      setCount((c) => c + (next ? -1 : 1));
    } finally {
      setPending(false);
    }
  }

  async function saveEdit() {
    if (saving) return;
    setSaving(true);
    try {
      const res = await updatePost(post.id, draft);
      setCaption(res.caption);
      setEditing(false);
      onUpdatedAction?.(post.id, res.caption);
      toast.success('Post updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update post');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (deleting) return;
    setDeleting(true);
    try {
      await deletePost(post.id);
      setConfirmOpen(false);
      setRemoved(true);
      if (onDeletedAction) onDeletedAction(post.id);
      else router.refresh();
      toast.success('Post deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete post');
      setDeleting(false);
    }
  }

  if (removed && !onDeletedAction) return null;

  const profileHref = post.authorUsername
    ? `/app/u/${post.authorUsername}`
    : '#';
  const displayName = post.authorName || 'Unknown';

  return (
    <article className='border-border bg-card overflow-hidden rounded-2xl border'>
      <header className='flex items-center gap-3 p-3'>
        <Link href={profileHref} className='shrink-0'>
          <UserAvatar
            name={displayName}
            image={post.authorImage}
            className='size-10'
          />
        </Link>
        <div className='flex min-w-0 flex-col leading-tight'>
          <div className='flex min-w-0 flex-wrap items-baseline gap-x-1.5'>
            <Link
              href={profileHref}
              className='truncate text-sm font-semibold hover:underline'
            >
              {displayName}
            </Link>
            {post.authorUsername ? (
              <Link
                href={profileHref}
                className='text-muted-foreground truncate text-xs hover:underline'
              >
                @{post.authorUsername}
              </Link>
            ) : null}
          </div>
          <LocalTime
            iso={post.createdAt}
            className='text-muted-foreground text-xs'
          />
        </div>

        {post.canManage ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label='Post options'
              className={cn(
                buttonVariants({ variant: 'ghost', size: 'icon' }),
                'text-muted-foreground ml-auto size-8 shrink-0',
              )}
            >
              <MoreHorizontal className='size-5' aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end' className='w-40'>
              <DropdownMenuItem
                className='gap-2'
                onClick={() => {
                  setDraft(caption ?? '');
                  setEditing(true);
                }}
              >
                <Pencil className='size-4' aria-hidden />
                Edit caption
              </DropdownMenuItem>
              <DropdownMenuItem
                variant='destructive'
                className='gap-2'
                onClick={() => setConfirmOpen(true)}
              >
                <Trash2 className='size-4' aria-hidden />
                Delete post
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </header>

      {post.imageUrl ? (
        <div className='bg-muted relative aspect-square w-full'>
          {/* Blob image; unoptimized to avoid remote-loader config. */}
          <img
            src={post.imageUrl || '/placeholder.svg'}
            alt={caption ? `Post: ${caption}` : 'Post image'}
            className='h-full w-full object-cover'
          />
        </div>
      ) : null}

      <div className={cn('flex flex-col gap-2 p-3', !post.imageUrl && 'pt-0')}>
        {/* Caption or Editing UI is now always on top */}
        {editing ? (
          <div className='flex flex-col gap-2'>
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder='Write a caption...'
              aria-label='Edit caption'
              className='resize-none'
            />
            <div className='flex items-center justify-end gap-2'>
              <Button
                type='button'
                variant='ghost'
                size='sm'
                disabled={saving}
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
              <Button
                type='button'
                size='sm'
                disabled={saving}
                onClick={saveEdit}
              >
                {saving ? (
                  <Loader2 className='size-4 animate-spin' aria-hidden />
                ) : (
                  'Save'
                )}
              </Button>
            </div>
          </div>
        ) : caption ? (
          post.imageUrl ? (
            // Image posts keep the classic "name caption" format
            <p className='text-sm leading-relaxed wrap-break-word whitespace-pre-wrap'>
              <Link
                href={profileHref}
                className='font-semibold hover:underline'
              >
                {displayName}
              </Link>{' '}
              {caption}
            </p>
          ) : (
            // Text-only posts drop the name (it's in the header)
            <p className='text-sm leading-relaxed text-pretty wrap-break-word whitespace-pre-wrap'>
              {caption}
            </p>
          )
        ) : null}

        {/* Like Row is now always on the bottom */}
        <div className='flex w-fit items-center gap-1'>
          <button
            type='button'
            onClick={toggle}
            className='flex items-center rounded-full p-0.5'
            aria-pressed={liked}
            aria-label={liked ? 'Unlike' : 'Like'}
          >
            <Heart
              className={cn(
                'size-6 transition-colors',
                liked ? 'fill-primary text-primary' : 'text-foreground',
              )}
              aria-hidden
            />
          </button>
          {count > 0 ? (
            <PostLikersDialog postId={post.id} count={count}>
              <button
                type='button'
                className='rounded px-1 text-sm font-medium tabular-nums hover:underline'
                aria-label={`See who liked this post (${count})`}
              >
                {count} {count === 1 ? 'like' : 'likes'}
              </button>
            </PostLikersDialog>
          ) : (
            <span className='text-muted-foreground px-1 text-sm font-medium tabular-nums'>
              No likes yet
            </span>
          )}
        </div>
      </div>

      <Dialog
        open={confirmOpen}
        onOpenChange={(o) => !deleting && setConfirmOpen(o)}
      >
        <DialogContent className='max-w-sm'>
          <DialogHeader>
            <DialogTitle>Delete this post?</DialogTitle>
            <DialogDescription>
              This permanently removes the post and its likes. This can&apos;t
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant='ghost'
              disabled={deleting}
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant='destructive'
              disabled={deleting}
              onClick={confirmDelete}
            >
              {deleting ? (
                <Loader2 className='size-4 animate-spin' aria-hidden />
              ) : (
                'Delete'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  );
}
