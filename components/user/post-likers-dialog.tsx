'use client';

import { getPostLikers } from '@/app/actions/posts';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { UserAvatar } from '@/components/user/user-avatar';
import type { PostLiker } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

export function PostLikersDialog({
  postId,
  count,
  children,
}: {
  postId: string;
  count: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [likers, setLikers] = useState<PostLiker[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setLoading(true);
      try {
        setLikers(await getPostLikers(postId));
      } catch {
        setLikers([]);
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className='sm:max-w-sm'>
        <DialogHeader>
          <DialogTitle>{count === 1 ? '1 like' : `${count} likes`}</DialogTitle>
        </DialogHeader>
        <div className='-mx-1 max-h-80 overflow-y-auto'>
          {loading ? (
            <div className='flex items-center justify-center py-10'>
              <Loader2
                className='text-muted-foreground size-5 animate-spin'
                aria-hidden
              />
            </div>
          ) : likers.length === 0 ? (
            <p className='text-muted-foreground py-10 text-center text-sm'>
              No likes yet.
            </p>
          ) : (
            <ul className='flex flex-col'>
              {likers.map((u) => {
                const href = u.username ? `/app/u/${u.username}` : '#';
                return (
                  <li key={u.id}>
                    <Link
                      href={href}
                      onClick={() => setOpen(false)}
                      className='hover:bg-secondary flex items-center gap-2 rounded-lg p-2 transition-colors'
                    >
                      <UserAvatar
                        name={u.name}
                        image={u.image}
                        className='size-9'
                      />
                      <div className='min-w-0 leading-tight'>
                        <p className='truncate text-sm font-medium'>{u.name}</p>
                        {u.username ? (
                          <p className='text-muted-foreground truncate text-xs'>
                            @{u.username}
                          </p>
                        ) : null}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
