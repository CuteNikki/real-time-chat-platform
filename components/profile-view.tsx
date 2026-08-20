'use client';

import { Suspense } from 'react';

import { LockIcon } from 'lucide-react';

import { Role } from '@/lib/roles';
import type { PostSummary, UserProfile } from '@/lib/types';

import { FriendshipButtons } from '@/components/friendship-buttons';
import { InterestTags } from '@/components/interest-tags';
import { PostGrid } from '@/components/post-grid';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/user-avatar';

export function ProfileView({
  profile,
  initialPosts,
  role,
}: {
  profile: UserProfile;
  initialPosts: PostSummary[];
  role: Role;
}) {
  return (
    <div className='h-full w-full overflow-y-auto'>
      <div className='mx-auto w-full max-w-4xl px-4 py-8 sm:px-6'>
        <header className='flex flex-col gap-6 sm:flex-row'>
          <UserAvatar
            name={profile.name}
            image={profile.image}
            className='size-24 sm:size-32'
          />
          <div className='flex flex-1 flex-col gap-4'>
            <div className='flex flex-col gap-2'>
              <div className='flex flex-wrap items-center justify-between'>
                <div className='flex min-w-0 flex-col'>
                  <span className='text-xl font-semibold tracking-tight text-balance'>
                    {profile.name}
                  </span>
                  <span className='text-muted-foreground text-sm'>
                    @{profile.username}
                  </span>
                </div>
                {profile.role !== 'MEMBER' ? (
                  <Badge variant='destructive'>
                    {profile.role === 'ADMIN' ? 'Admin' : 'Moderator'}
                  </Badge>
                ) : null}
              </div>
              {profile.bio ? (
                <p className='text-muted-foreground line-clamp-4 max-w-prose text-sm whitespace-pre-wrap'>
                  {profile.bio}
                </p>
              ) : null}
              <InterestTags interests={profile.interests} />
            </div>

            <div className='flex items-center gap-6 text-sm'>
              <span>
                <strong className='font-semibold tabular-nums'>
                  {profile.postCount}
                </strong>{' '}
                <span className='text-muted-foreground'>post(s)</span>
              </span>
              <span>
                <strong className='font-semibold tabular-nums'>
                  {profile.friendCount}
                </strong>{' '}
                <span className='text-muted-foreground'>friend(s)</span>
              </span>
            </div>

            <div className='flex flex-wrap items-center gap-2'>
              <FriendshipButtons initialProfile={profile} />
            </div>
          </div>
        </header>

        <div className='border-border mt-8 border-t pt-6'>
          {profile.postsVisible || role === 'ADMIN' || role === 'MODERATOR' ? (
            <Suspense fallback={null}>
              <PostGrid posts={initialPosts} isOwnProfile={profile.isSelf} />
            </Suspense>
          ) : (
            <div className='flex h-full flex-col items-center justify-center gap-4 p-6 text-center'>
              <div className='bg-accent relative mb-4 flex size-28 shrink-0 items-center justify-center rounded-full'>
                <LockIcon
                  className='text-primary size-12 shrink-0'
                  aria-hidden
                />
              </div>
              <div className='flex flex-col items-center gap-2'>
                <span className='text-3xl font-semibold tracking-tight text-balance'>
                  Unauthorized
                </span>
                <p className='text-muted-foreground max-w-sm text-balance'>
                  You need to be friends with this user to view their posts.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
