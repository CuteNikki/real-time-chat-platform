'use client';

import {
  cancelFriendRequest,
  removeFriend,
  respondToRequest,
  sendFriendRequest,
} from '@/app/actions/invites';
import { InterestTags } from '@/components/interest-tags';
import { PostGrid } from '@/components/post-grid';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/user-avatar';
import type { PostSummary, UserProfile } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  Check,
  Clock,
  Lock,
  MessageCircle,
  Pencil,
  UserMinus,
  UserPlus,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Suspense, useState } from 'react';
import { toast } from 'sonner';

export function ProfileView({
  profile,
  initialPosts,
}: {
  profile: UserProfile;
  initialPosts: PostSummary[];
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
        <header className='flex flex-col gap-6 sm:flex-row sm:items-center'>
          <UserAvatar
            name={profile.name}
            image={profile.image}
            className='size-24 sm:size-32'
          />
          <div className='flex flex-1 flex-col gap-3'>
            <div className='flex flex-col gap-1'>
              <div className='flex flex-wrap items-center gap-x-3 gap-y-1'>
                <h1 className='text-xl font-semibold tracking-tight text-balance'>
                  {profile.name}
                </h1>
                {profile.username ? (
                  <span className='text-muted-foreground text-sm'>
                    @{profile.username}
                  </span>
                ) : null}
                {profile.role !== 'MEMBER' ? (
                  <Badge
                    className={cn(
                      'border-transparent',
                      profile.role === 'ADMIN'
                        ? 'bg-primary/15 text-primary'
                        : 'bg-chart-2/15 text-chart-2',
                    )}
                  >
                    {profile.role === 'ADMIN' ? 'Admin' : 'Moderator'}
                  </Badge>
                ) : null}
              </div>
              {profile.bio ? (
                <p className='text-muted-foreground max-w-prose text-sm leading-relaxed text-pretty'>
                  {profile.bio}
                </p>
              ) : null}
              <InterestTags interests={profile.interests} className='mt-1' />
            </div>

            <div className='flex items-center gap-6 text-sm'>
              <span>
                <strong className='font-semibold tabular-nums'>
                  {profile.postCount}
                </strong>{' '}
                <span className='text-muted-foreground'>posts</span>
              </span>
              <span>
                <strong className='font-semibold tabular-nums'>
                  {profile.friendCount}
                </strong>{' '}
                <span className='text-muted-foreground'>friends</span>
              </span>
            </div>

            <div className='flex flex-wrap items-center gap-2'>
              {profile.isSelf ? (
                <Button
                  variant='secondary'
                  className='gap-2'
                  render={<Link href='/app/settings' />}
                >
                  <Pencil className='size-4' aria-hidden />
                  Edit profile
                </Button>
              ) : status === 'friends' ? (
                <>
                  <Button
                    className='gap-2'
                    disabled={!dmChatId}
                    onClick={() =>
                      dmChatId && router.push(`/app/messages?c=${dmChatId}`)
                    }
                  >
                    <MessageCircle className='size-4' aria-hidden />
                    Message
                  </Button>
                  <Button
                    variant='ghost'
                    className='text-muted-foreground gap-2'
                    disabled={busy}
                    onClick={unfriend}
                  >
                    <UserMinus className='size-4' aria-hidden />
                    Friends
                  </Button>
                </>
              ) : status === 'incoming' ? (
                <Button className='gap-2' disabled={busy} onClick={accept}>
                  <Check className='size-4' aria-hidden />
                  Accept request
                </Button>
              ) : status === 'outgoing' ? (
                <Button
                  variant='secondary'
                  className='group/req gap-2'
                  disabled={busy}
                  onClick={cancelRequest}
                >
                  <Clock
                    className='size-4 group-hover/req:hidden'
                    aria-hidden
                  />
                  <X
                    className='hidden size-4 group-hover/req:block'
                    aria-hidden
                  />
                  <span className='group-hover/req:hidden'>Requested</span>
                  <span className='hidden group-hover/req:inline'>
                    Cancel request
                  </span>
                </Button>
              ) : (
                <Button className='gap-2' disabled={busy} onClick={add}>
                  <UserPlus className='size-4' aria-hidden />
                  Add friend
                </Button>
              )}
            </div>
          </div>
        </header>

        <div className='border-border mt-8 border-t pt-6'>
          {profile.postsVisible ? (
            <Suspense fallback={null}>
              <PostGrid
                posts={initialPosts}
                emptyLabel={
                  profile.isSelf ? "You haven't posted yet." : 'No posts yet.'
                }
                isOwnProfile={profile.isSelf}
              />
            </Suspense>
          ) : (
            <div className='flex flex-col items-center gap-3 py-16 text-center'>
              <div className='bg-muted flex size-14 items-center justify-center rounded-full'>
                <Lock className='text-muted-foreground size-6' aria-hidden />
              </div>
              <p className='text-muted-foreground text-sm'>
                {profile.name}&apos;s posts are only visible to friends.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
