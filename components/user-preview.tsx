'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import {
  CheckIcon,
  ClockIcon,
  ExternalLinkIcon,
  Loader2Icon,
  MessageCircle,
  UserMinus2Icon,
  UserPlus2Icon,
  XIcon,
} from 'lucide-react';

import {
  cancelFriendRequest,
  removeFriend,
  sendFriendRequest,
} from '@/app/actions/invites';
import { getProfilePreview } from '@/app/actions/profile';

import type { UserProfile } from '@/lib/types';

import { InterestTags } from '@/components/interest-tags';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { UserAvatar } from '@/components/user-avatar';
import Link from 'next/link';

export function UserPreviewDialog({
  userId,
  onCloseAction,
}: {
  userId: string | null;
  onCloseAction: () => void;
}) {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

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

  async function addOrAccept() {
    if (!profile) return;
    setBusy(true);
    try {
      // sendFriendRequest also auto-accepts if they had already requested us.
      const res = await sendFriendRequest(profile.id);
      if ('status' in res && res.status === 'accepted') {
        setProfile({
          ...profile,
          friendStatus: 'friends',
          dmChatId: 'chatId' in res ? (res.chatId ?? null) : null,
        });
        toast.success(`You and ${profile.name} are now friends`);
      } else {
        setProfile({ ...profile, friendStatus: 'outgoing' });
        toast.success('Friend request sent');
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Could not send request',
      );
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!profile) return;
    setBusy(true);
    try {
      await cancelFriendRequest(profile.id);
      setProfile({ ...profile, friendStatus: 'none' });
      toast.success('Request canceled');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not cancel');
    } finally {
      setBusy(false);
    }
  }

  async function unfriend() {
    if (!profile) return;
    setBusy(true);
    try {
      await removeFriend(profile.id);
      setProfile({ ...profile, friendStatus: 'none' });
      toast.success('Unfriended successfully');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not unfriend');
    } finally {
      setBusy(false);
    }
  }

  function message() {
    if (!profile?.dmChatId) return;
    onCloseAction();
    router.push(`/app/messages?c=${profile.dmChatId}`);
  }

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
              <p className='text-muted-foreground mt-2 line-clamp-4 max-w-[16rem] text-sm leading-relaxed text-pretty whitespace-pre-wrap'>
                {profile.bio}
              </p>
            ) : null}
            <InterestTags
              interests={profile.interests}
              className='justify-center'
              max={4}
            />

            <div className='mt-3 flex items-center gap-6 text-sm'>
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

            <div className='mt-5 flex w-full flex-col gap-2'>
              {profile.isSelf ? null : profile.friendStatus === 'friends' ? (
                <div className='flex gap-2'>
                  <Button
                    className='flex-1'
                    disabled={!profile.dmChatId}
                    onClick={message}
                  >
                    <MessageCircle className='shrink-0' aria-hidden />
                    Message
                  </Button>
                  <Button
                    variant='destructive'
                    disabled={busy}
                    onClick={unfriend}
                  >
                    {busy ? (
                      <>
                        <Loader2Icon
                          className='shrink-0 animate-spin'
                          aria-hidden
                        />
                        Removing...
                      </>
                    ) : (
                      <>
                        <UserMinus2Icon className='shrink-0' aria-hidden />
                        Remove Friend
                      </>
                    )}
                  </Button>
                </div>
              ) : profile.friendStatus === 'outgoing' ? (
                <Button
                  variant='secondary'
                  className='group/req gap-2'
                  disabled={busy}
                  onClick={cancel}
                >
                  {busy ? (
                    <Loader2Icon
                      className='shrink-0 animate-spin'
                      aria-hidden
                    />
                  ) : (
                    <>
                      <ClockIcon
                        className='shrink-0 group-hover/req:hidden'
                        aria-hidden
                      />
                      <XIcon
                        className='hidden shrink-0 group-hover/req:inline'
                        aria-hidden
                      />
                    </>
                  )}
                  <span className='group-hover/req:hidden'>
                    {busy ? 'Cancelling...' : 'Requested'}
                  </span>
                  <span className='hidden group-hover/req:inline'>
                    {busy ? 'Cancelling...' : 'Cancel'}
                  </span>
                </Button>
              ) : profile.friendStatus === 'incoming' ? (
                <Button className='gap-2' disabled={busy} onClick={addOrAccept}>
                  {busy ? (
                    <>
                      <Loader2Icon
                        className='shrink-0 animate-spin'
                        aria-hidden
                      />
                      Accepting...
                    </>
                  ) : (
                    <>
                      <CheckIcon className='shrink-0' aria-hidden />
                      Accept Request
                    </>
                  )}
                </Button>
              ) : (
                <Button className='gap-2' disabled={busy} onClick={addOrAccept}>
                  {busy ? (
                    <>
                      <Loader2Icon
                        className='shrink-0 animate-spin'
                        aria-hidden
                      />
                      Adding...
                    </>
                  ) : (
                    <>
                      <UserPlus2Icon className='shrink-0' aria-hidden />
                      Add Friend
                    </>
                  )}
                </Button>
              )}

              <Button variant='outline' className='gap-2' asChild>
                <Link
                  href={profile.username ? `/app/u/${profile.username}` : '#'}
                  onClick={onCloseAction}
                >
                  <ExternalLinkIcon className='size-4' aria-hidden />
                  View Full Profile
                </Link>
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
