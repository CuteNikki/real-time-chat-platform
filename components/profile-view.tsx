'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Suspense, useState } from 'react';
import { toast } from 'sonner';

import {
  CheckIcon,
  ClockIcon,
  Loader2Icon,
  LockIcon,
  MessageCircle,
  PencilIcon,
  UserMinus2Icon,
  UserPlus2Icon,
  XIcon,
} from 'lucide-react';

import {
  cancelFriendRequest,
  removeFriend,
  respondToRequest,
  sendFriendRequest,
} from '@/app/actions/invites';

import { Role } from '@/lib/roles';
import type { PostSummary, UserProfile } from '@/lib/types';

import { InterestTags } from '@/components/interest-tags';
import { PostGrid } from '@/components/post-grid';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  const router = useRouter();
  const [status, setStatus] = useState(profile.friendStatus);
  const [dmChatId, setDmChatId] = useState(profile.dmChatId);
  const [busy, setBusy] = useState(false);

  async function add() {
    setBusy(true);
    try {
      const res = await sendFriendRequest(profile.id);
      // If they had already requested us, this accepts and returns a chat.
      if ('status' in res && res.status === 'accepted') {
        setStatus('friends');
        if ('chatId' in res && res.chatId) setDmChatId(res.chatId);
        toast.success(`You and ${profile.name} are now friends`);
      } else {
        setStatus('outgoing');
        toast.success('Friend request sent');
      }
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Could not send request',
      );
    } finally {
      setBusy(false);
    }
  }

  async function accept() {
    setBusy(true);
    try {
      // Find the incoming request id via the pending list endpoint.
      const res = await fetch('/api/invites/pending').then((r) => r.json());
      const inv = (res as { id: string; senderId: string }[]).find(
        (i) => i.senderId === profile.id,
      );
      if (!inv) throw new Error('Request not found');
      const out = await respondToRequest(inv.id, true);
      if (out.status === 'accepted') {
        setStatus('friends');
        setDmChatId(out.chatId);
        toast.success(`You and ${profile.name} are now friends`);
        router.refresh();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not accept');
    } finally {
      setBusy(false);
    }
  }

  async function cancelRequest() {
    setBusy(true);
    try {
      await cancelFriendRequest(profile.id);
      setStatus('none');
      toast.success('Request canceled');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not cancel');
    } finally {
      setBusy(false);
    }
  }

  async function unfriend() {
    setBusy(true);
    try {
      await removeFriend(profile.id);
      setStatus('none');
      setDmChatId(null);
      toast.success('Removed friend');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not remove');
    } finally {
      setBusy(false);
    }
  }

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
                <p className='text-muted-foreground max-w-prose text-sm leading-relaxed text-pretty'>
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
              {profile.isSelf ? (
                <Button variant='secondary' asChild>
                  <Link href='/app/settings'>
                    <PencilIcon className='shrink-0' aria-hidden />
                    Edit Profile
                  </Link>
                </Button>
              ) : status === 'friends' ? (
                <>
                  <Button
                    disabled={!dmChatId}
                    onClick={() =>
                      dmChatId && router.push(`/app/messages?c=${dmChatId}`)
                    }
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
                </>
              ) : status === 'incoming' ? (
                <Button className='gap-2' disabled={busy} onClick={accept}>
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
              ) : status === 'outgoing' ? (
                <Button
                  variant='secondary'
                  className='group/req gap-2'
                  disabled={busy}
                  onClick={cancelRequest}
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
                        className='hidden shrink-0 group-hover/req:block'
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
              ) : (
                <Button className='gap-2' disabled={busy} onClick={add}>
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
