'use client';

import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ImageIcon, PlusIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { PostSummary } from '@/lib/types';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { PostCard } from '@/components/user/post-card';

export function PostGrid({
  posts,
  isOwnProfile = false,
  canModerate = false,
}: {
  posts: PostSummary[];
  isOwnProfile?: boolean;
  canModerate?: boolean;
}) {
  const [items, setItems] = useState<PostSummary[]>(posts);
  const [activeId, setActiveId] = useState<string | null>(null);
  const { t } = useTranslation();
  // Tracks the open post's fullscreen image viewer. While it's up, the dialog
  // must not dismiss on the clicks/Escape that belong to the viewer (which is
  // portaled to <body>, so Radix would otherwise read them as "outside").
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    setItems(posts);
  }, [posts]);

  useEffect(() => {
    const postId = searchParams.get('post');
    if (!postId) return;
    if (items.some((p) => p.id === postId)) {
      setActiveId(postId);
      const params = new URLSearchParams(searchParams);
      params.delete('post');
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
  }, [searchParams, items, router, pathname]);

  const active = items.find((p) => p.id === activeId) ?? null;

  if (items.length === 0 && !isOwnProfile) {
    return (
      <EmptyState
        icon={ImageIcon}
        title={t('post.grid.lookingEmpty')}
        description={t('post.grid.lookingEmptyDesc')}
        className='h-full'
      />
    );
  }

  return (
    <>
      <div className='xs:grid-cols-3 grid grid-cols-2 gap-1 sm:gap-2 md:grid-cols-4'>
        {isOwnProfile ? (
          <button
            type='button'
            onClick={() => {
              router.push('/app/feed');
            }}
            className='group border-border hover:bg-muted bg-card relative flex aspect-square flex-col items-center justify-center gap-2 overflow-hidden rounded-md border-2 border-dashed transition-colors'
          >
            <div className='bg-primary/80 flex size-10 items-center justify-center rounded-full'>
              <PlusIcon className='shrink-0' aria-hidden />
            </div>
            <span className='text-muted-foreground text-xs font-medium'>
              {t('post.grid.newPost')}
            </span>
          </button>
        ) : null}

        {items.map((p) => (
          <button
            key={p.id}
            type='button'
            onClick={() => setActiveId(p.id)}
            className='group bg-card relative aspect-square overflow-hidden rounded-md'
          >
            {p.imageUrl ? (
              <Image
                src={p.imageUrl || '/placeholder.svg'}
                alt={p.caption ?? t('post.grid.postAlt')}
                fill
                sizes='(max-width: 640px) 33vw, 300px'
                className='group-hover:bg-muted object-cover transition-transform group-hover:scale-105'
              />
            ) : (
              <div className='bg-card group-hover:bg-muted flex h-full w-full min-w-0 items-center justify-center p-3 transition-all group-hover:scale-105'>
                <p className='text-secondary-foreground line-clamp-5 w-full text-center text-xs leading-snug wrap-break-word'>
                  {p.caption ?? ''}
                </p>
              </div>
            )}
          </button>
        ))}
      </div>

      <Dialog
        open={!!active}
        onOpenChange={(open) => {
          if (!open) {
            setActiveId(null);
            setLightboxOpen(false);
          }
        }}
      >
        <DialogContent
          showCloseButton={false}
          className='border-0 bg-transparent p-0 ring-0 sm:max-w-md'
          // The image viewer lives in a body portal, so its clicks/Escape read
          // as "outside" this dialog. Ignore those dismissals while it's open.
          onInteractOutside={(e) => {
            if (lightboxOpen) e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            if (lightboxOpen) e.preventDefault();
          }}
        >
          <DialogTitle className='sr-only'>
            {active
              ? t('post.grid.postByAuthor', { name: active.authorName })
              : t('post.grid.postAlt')}
          </DialogTitle>
          {active ? (
            <div className='max-h-[85vh] overflow-y-auto'>
              <PostCard
                key={active.id}
                post={active}
                canModerate={canModerate}
                onLightboxOpenChangeAction={setLightboxOpen}
                onDeletedAction={(id) => {
                  setActiveId(null);
                  setItems((prev) => prev.filter((p) => p.id !== id));
                }}
                onUpdatedAction={(id, caption) =>
                  setItems((prev) =>
                    prev.map((p) => (p.id === id ? { ...p, caption } : p)),
                  )
                }
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
