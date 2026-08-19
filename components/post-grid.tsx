'use client';

import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ImageIcon, PlusIcon } from 'lucide-react';

import type { PostSummary } from '@/lib/types';

import { PostCard } from '@/components/post-card';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

export function PostGrid({
  posts,
  isOwnProfile = false,
}: {
  posts: PostSummary[];
  isOwnProfile?: boolean;
}) {
  const [items, setItems] = useState<PostSummary[]>(posts);
  const [activeId, setActiveId] = useState<string | null>(null);
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
      <div className='flex h-full flex-col items-center justify-center gap-4 p-6 text-center'>
        <div className='bg-accent relative mb-4 flex size-28 shrink-0 items-center justify-center rounded-full'>
          <ImageIcon className='text-primary size-12 shrink-0' aria-hidden />
        </div>
        <div className='flex flex-col items-center gap-2'>
          <span className='text-3xl font-semibold tracking-tight text-balance'>
            Looking Empty
          </span>
          <p className='text-muted-foreground max-w-sm text-pretty'>
            This user hasn't posted anything yet. Check back later!
          </p>
        </div>
      </div>
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
            <div className='bg-primary/80 flex size-10 items-center justify-center rounded-full transition-all group-hover:scale-110'>
              <PlusIcon className='shrink-0' aria-hidden />
            </div>
            <span className='text-muted-foreground group-hover:text-foreground text-xs font-medium transition-all group-hover:scale-110'>
              New Post
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
                alt={p.caption ?? 'Post'}
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
        onOpenChange={(open) => !open && setActiveId(null)}
      >
        <DialogContent
          showCloseButton={false}
          className='border-0 bg-transparent p-0 ring-0 sm:max-w-md'
        >
          <DialogTitle className='sr-only'>
            {active ? `Post by ${active.authorName}` : 'Post'}
          </DialogTitle>
          {active ? (
            <div className='max-h-[85vh] overflow-y-auto'>
              <PostCard
                post={active}
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
