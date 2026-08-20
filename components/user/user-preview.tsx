'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Loader2Icon } from 'lucide-react';

import { getProfilePreview } from '@/app/actions/profile';

import type { UserProfile } from '@/lib/types';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { FriendshipButtons } from '@/components/user/friendship-buttons';
import { InterestTags } from '@/components/user/interest-tags';
import { UserAvatar } from '@/components/user/user-avatar';

export function UserPreviewDialog({
  userId,
  onCloseAction,
}: {
  userId: string | null;
  onCloseAction: () => void;
}) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      return;
    }
    let active = true;
    setLoading(true);
    getProfilePreview(userId)
      .then((p) => {
        if (active) setProfile(p);
      })
      .catch(() => {
        if (active) toast.error('Could not load profile');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  return (
    <Dialog
      open={userId !== null}
      onOpenChange={(open) => !open && onCloseAction()}
    >
      <DialogContent className='max-w-xs'>
        <DialogTitle className='sr-only'>Profile Preview</DialogTitle>
        {loading || !profile ? (
          <div className='flex h-44 items-center justify-center'>
            <Loader2Icon
              className='text-muted-foreground size-6 animate-spin'
              aria-hidden
            />
          </div>
        ) : (
          <div className='flex flex-col items-center gap-2 pt-2 text-center'>
            <UserAvatar
              name={profile.name}
              image={profile.image}
              className='size-20'
            />
            <div className='flex flex-col'>
              <span className='text-lg font-semibold text-balance'>
                {profile.name}
              </span>
              <p className='text-muted-foreground text-sm'>
                @{profile.username}
              </p>
            </div>
            {profile.bio ? (
              <p className='text-muted-foreground line-clamp-4 text-sm whitespace-pre-wrap'>
                {profile.bio}
              </p>
            ) : null}
            <InterestTags
              interests={profile.interests}
              className='justify-center'
              max={4}
            />

            <div className='flex items-center gap-6 py-4 text-sm'>
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

            <FriendshipButtons
              initialProfile={profile}
              onCloseAction={onCloseAction}
              showFullProfileButton
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
