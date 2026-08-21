'use client';

import { Suspense } from 'react';

import { LockIcon } from 'lucide-react';

import { atLeast, Role } from '@/lib/roles';
import type { PostSummary, UserProfile } from '@/lib/types';

import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { FriendshipButtons } from '@/components/user/friendship-buttons';
import { InterestTags } from '@/components/user/interest-tags';
import { MentionText } from '@/components/user/mention-text';
import { PostGrid } from '@/components/user/post-grid';
import { ReportUserButton } from '@/components/user/report-user-button';
import { UserAvatar } from '@/components/user/user-avatar';

export function ProfileView({
  profile,
  initialPosts,
  role,
}: {
  profile: UserProfile;
  initialPosts: PostSummary[];
  role: Role;
}) {
  // A moderator/admin may delete this profile owner's posts, mirroring the
  // server guard in moderatorDeletePost: never your own posts here (those use
  // the normal owner controls), and only users at or below your own role —
  // moderators cover members + moderators, admins cover everyone.
  const canModerate =
    !profile.isSelf &&
    atLeast(role, 'MODERATOR') &&
    atLeast(role, profile.role);

  return (
    <div className='w-full'>
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
                  <MentionText text={profile.bio} />
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
              {!profile.isSelf ? (
                <ReportUserButton
                  reportedUserId={profile.id}
                  name={profile.name}
                />
              ) : null}
            </div>
          </div>
        </header>

        <div className='border-border mt-8 border-t pt-6'>
          {profile.postsVisible || role === 'ADMIN' || role === 'MODERATOR' ? (
            <Suspense fallback={null}>
              <PostGrid
                posts={initialPosts}
                isOwnProfile={profile.isSelf}
                canModerate={canModerate}
              />
            </Suspense>
          ) : (
            <EmptyState
              icon={LockIcon}
              title='Unauthorized'
              description='You need to be friends with this user to view their posts.'
              className='h-full'
            />
          )}
        </div>
      </div>
    </div>
  );
}
