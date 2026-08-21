'use client';

import { deletePost, toggleLike, updatePost } from '@/app/actions/posts';
import { moderatorDeletePost } from '@/app/actions/moderation';
import { formatExactTimestamp, formatPostTime } from '@/lib/format-time';
import { ImageLightbox } from '@/components/chat/image-lightbox';
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
import { MentionText } from '@/components/user/mention-text';
import { MentionTextarea } from '@/components/user/mention-textarea';
import { PostLikersDialog } from '@/components/user/post-likers-dialog';
import { ReportDialog } from '@/components/report-dialog';
import { UserAvatar } from '@/components/user/user-avatar';
import type { PostSummary } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Flag, Heart, Loader2, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

export function PostCard({
  post,
  canModerate = false,
  onDeletedAction,
  onUpdatedAction,
  onLightboxOpenChange,
}: {
  post: PostSummary;
  canModerate?: boolean;
  onDeletedAction?: (id: string) => void;
  onUpdatedAction?: (id: string, caption: string | null) => void;
  // Notified when the fullscreen viewer opens/closes. A PostCard rendered inside
  // a Radix Dialog (e.g. the profile grid) uses this to keep the dialog from
  // dismissing on clicks that land on the body-portaled lightbox.
  onLightboxOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const [liked, setLiked] = useState(post.likedByMe);
  const [count, setCount] = useState(post.likeCount);
  const [pending, setPending] = useState(false);

  // Fullscreen zoomable viewer + the double-tap-to-like burst (a counter so each
  // tap restarts the animation via a changing React key).
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [burst, setBurst] = useState(0);
  // Distinguishes a single click (open the viewer) from a double click/tap
  // (like) on the image without firing both.
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Open/close the viewer, keeping any host dialog informed so it can suspend
  // its own dismiss-on-outside behavior while the viewer is up.
  function setLightbox(open: boolean) {
    setLightboxOpen(open);
    onLightboxOpenChange?.(open);
  }

  const [caption, setCaption] = useState(post.caption);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.caption ?? '');
  const [saving, setSaving] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

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

  // Double-tap the image to like. Like the familiar gesture, this only ever
  // likes — never unlikes — but always plays the heart burst so the tap feels
  // acknowledged even when the post was already liked.
  async function likeFromDoubleTap() {
    setBurst((n) => n + 1);
    if (liked || pending) return;
    setLiked(true);
    setCount((c) => c + 1);
    setPending(true);
    try {
      const res = await toggleLike(post.id);
      setLiked(res.liked);
      if (!res.liked) setCount((c) => c - 1);
    } catch {
      setLiked(false);
      setCount((c) => c - 1);
    } finally {
      setPending(false);
    }
  }

  // A single click opens the viewer; a second click within the window is a
  // double-tap-to-like instead. Deferring the open by one tick lets us cancel it
  // when the second click lands.
  function onImageClick() {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
      likeFromDoubleTap();
      return;
    }
    clickTimer.current = setTimeout(() => {
      clickTimer.current = null;
      setLightbox(true);
    }, 250);
  }

  // Don't leave a pending open-viewer timer behind on unmount.
  useEffect(
    () => () => {
      if (clickTimer.current) clearTimeout(clickTimer.current);
    },
    [],
  );

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
      // Owners remove their own posts; moderators use the moderation action to
      // remove someone else's.
      if (post.canManage) {
        await deletePost(post.id);
      } else {
        await moderatorDeletePost(post.id);
      }
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

  // Owner controls (edit + delete) vs. a moderator's delete-only affordance on
  // someone else's post.
  const isOwner = post.canManage;
  const showModeratorDelete = !isOwner && canModerate;
  // Anyone who isn't the author can report a post.
  const canReport = !isOwner;
  const showMenu = isOwner || showModeratorDelete || canReport;

  const profileHref = post.authorUsername
    ? `/app/u/${post.authorUsername}`
    : '#';
  const displayName = post.authorName || 'Unknown';

  return (
    <article className='border-border bg-card overflow-hidden rounded-2xl border'>
      <header className='flex items-start gap-3 p-3'>
        <Link href={profileHref} className='shrink-0'>
          <UserAvatar
            name={displayName}
            image={post.authorImage}
            className='size-10'
          />
        </Link>
        <div className='flex min-w-0 flex-1 flex-col leading-tight'>
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
          {/* On phones the top-right stamp would eat into the name, so it sits
              under the names instead and only moves top-right at sm+. */}
          <time
            dateTime={post.createdAt}
            title={formatExactTimestamp(post.createdAt)}
            className='text-muted-foreground text-xs whitespace-nowrap sm:hidden'
            suppressHydrationWarning
          >
            {formatPostTime(post.createdAt)}
          </time>
        </div>

        <div className='flex shrink-0 items-center gap-1'>
          <time
            dateTime={post.createdAt}
            title={formatExactTimestamp(post.createdAt)}
            className='text-muted-foreground hidden text-xs whitespace-nowrap sm:block'
            suppressHydrationWarning
          >
            {formatPostTime(post.createdAt)}
          </time>

          {showMenu ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label='Post options'
                className={cn(
                  buttonVariants({ variant: 'ghost', size: 'icon' }),
                  'text-muted-foreground -mr-1 size-8 shrink-0',
                )}
              >
                <MoreHorizontal className='size-5' aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end' className='w-40'>
                {isOwner ? (
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
                ) : null}
                {canReport ? (
                  <DropdownMenuItem
                    className='gap-2'
                    onClick={() => setReportOpen(true)}
                  >
                    <Flag className='size-4' aria-hidden />
                    Report post
                  </DropdownMenuItem>
                ) : null}
                {isOwner || showModeratorDelete ? (
                  <DropdownMenuItem
                    variant='destructive'
                    className='gap-2'
                    onClick={() => setConfirmOpen(true)}
                  >
                    <Trash2 className='size-4' aria-hidden />
                    Delete post
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </header>

      {post.imageUrl ? (
        <div className='bg-muted relative aspect-square w-full'>
          {/* Blob image; unoptimized to avoid remote-loader config. Click opens
              the zoomable viewer, double-tap likes. */}
          <img
            src={post.imageUrl || '/placeholder.svg'}
            alt={caption ? `Post: ${caption}` : 'Post image'}
            onClick={onImageClick}
            draggable={false}
            className='h-full w-full cursor-zoom-in object-cover select-none'
          />
          {/* Heart burst on double-tap; keyed so each tap restarts it. */}
          {burst > 0 ? (
            <span
              key={burst}
              className='pointer-events-none absolute inset-0 flex items-center justify-center'
            >
              <Heart className='animate-heart-pop size-24 fill-white text-white opacity-0 drop-shadow-lg' aria-hidden />
            </span>
          ) : null}
        </div>
      ) : null}

      <div className={cn('flex flex-col gap-2 p-3', !post.imageUrl && 'pt-0')}>
        {/* Caption or Editing UI is now always on top */}
        {editing ? (
          <div className='flex flex-col gap-2'>
            <MentionTextarea
              value={draft}
              onValueChange={setDraft}
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
              <MentionText text={caption} />
            </p>
          ) : (
            // Text-only posts drop the name (it's in the header)
            <p className='text-sm leading-relaxed text-pretty wrap-break-word whitespace-pre-wrap'>
              <MentionText text={caption} />
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
      {post.imageUrl ? (
        <ImageLightbox
          open={lightboxOpen}
          src={post.imageUrl}
          alt={caption ? `Post: ${caption}` : 'Post image'}
          onClose={() => setLightbox(false)}
        />
      ) : null}

      <ReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        target={{
          reportedUserId: post.authorId,
          name: displayName,
          postId: post.id,
        }}
      />
    </article>
  );
}
