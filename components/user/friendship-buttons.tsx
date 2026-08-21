import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  declineFriendRequestByUserId,
  removeFriend,
  sendFriendRequest,
} from '@/app/actions/invites';

import { Button } from '@/components/ui/button';

export type InitialProfile = {
  id: string;
  name: string;
  username: string | null;
  image: string | null;
  friendStatus: 'none' | 'friends' | 'incoming' | 'outgoing';
  dmChatId: string | null;
  isSelf?: boolean;
};

export function FriendshipButtons({
  initialProfile,
  showFullProfileButton = false,
  onCloseAction,
  onUpdateAction,
}: {
  initialProfile?: InitialProfile;
  showFullProfileButton?: boolean;
  onCloseAction?: () => void;
  onUpdateAction?: (
    status: 'none' | 'friends' | 'incoming' | 'outgoing',
    chatId?: string | null,
  ) => void;
}) {
  const [profile, setProfile] = useState<InitialProfile | null>(
    initialProfile ?? null,
  );
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const { t } = useTranslation();

  function message() {
    if (!profile?.dmChatId) return;
    if (onCloseAction) onCloseAction();
    router.push(`/app/messages?c=${profile.dmChatId}`);
  }

  async function unfriend() {
    if (!profile) return;
    setBusy(true);
    try {
      await removeFriend(profile.id);
      setProfile({ ...profile, friendStatus: 'none' });
      if (onUpdateAction) onUpdateAction('none');
      toast.success(t('friendship.unfriended'));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t('friendship.couldNotUnfriend'),
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
      if (onUpdateAction) onUpdateAction('none');
      toast.success(t('friendship.requestCanceled'));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t('friendship.couldNotCancel'),
      );
      setProfile({ ...profile, friendStatus: 'none' });
    } finally {
      setBusy(false);
    }
  }

  async function addOrAccept() {
    if (!profile) return;
    setBusy(true);
    try {
      const res = await sendFriendRequest(profile.id);
      if ('status' in res && res.status === 'accepted') {
        setProfile({
          ...profile,
          friendStatus: 'friends',
          dmChatId: res.chatId ?? null,
        });
        if (onUpdateAction) onUpdateAction('friends', res.chatId);
        toast.success(t('friendship.nowFriends', { name: profile.name }));
      } else {
        setProfile({ ...profile, friendStatus: 'outgoing' });
        if (onUpdateAction) onUpdateAction('outgoing');
        toast.success(t('friendship.requestSent'));
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t('friendship.couldNotSend'),
      );
    } finally {
      setBusy(false);
    }
  }

  async function decline() {
    if (!profile) return;
    setBusy(true);
    try {
      await declineFriendRequestByUserId(profile.id);
      setProfile({ ...profile, friendStatus: 'none' });
      if (onUpdateAction) onUpdateAction('none');
      toast.success(t('friendship.requestDeclined'));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t('friendship.couldNotDecline'),
      );
    } finally {
      setBusy(false);
    }
  }

  if (profile?.isSelf && showFullProfileButton) {
    return (
      <Button variant='outline' className='gap-2' asChild>
        <Link
          href={profile?.username ? `/app/u/${profile.username}` : '#'}
          onClick={onCloseAction}
        >
          <ExternalLinkIcon className='size-4' aria-hidden />
          {t('friendship.viewFullProfile')}
        </Link>
      </Button>
    );
  }

  if (profile?.isSelf) return null;

  return (
    <div className='flex flex-col gap-2'>
      {profile?.friendStatus === 'friends' ? (
        <div className='flex gap-2'>
          <Button
            className='flex-1'
            disabled={!profile?.dmChatId}
            onClick={message}
          >
            <MessageCircle className='shrink-0' aria-hidden />
            {t('friendship.message')}
          </Button>
          <Button variant='destructive' disabled={busy} onClick={unfriend}>
            {busy ? (
              <>
                <Loader2Icon className='shrink-0 animate-spin' aria-hidden />
                {t('friendship.removing')}
              </>
            ) : (
              <>
                <UserMinus2Icon className='shrink-0' aria-hidden />
                {t('friendship.remove')}
              </>
            )}
          </Button>
        </div>
      ) : profile?.friendStatus === 'outgoing' ? (
        <Button
          variant='secondary'
          className='group/req gap-2'
          disabled={busy}
          onClick={cancel}
        >
          {busy ? (
            <Loader2Icon className='shrink-0 animate-spin' aria-hidden />
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
            {busy ? t('friendship.cancelling') : t('friendship.pending')}
          </span>
          <span className='hidden group-hover/req:inline'>
            {busy ? t('friendship.cancelling') : t('friendship.cancel')}
          </span>
        </Button>
      ) : profile?.friendStatus === 'incoming' ? (
        <div className='flex flex-1 gap-2'>
          {busy ? (
            <Button variant='secondary' disabled={busy}>
              <Loader2Icon className='shrink-0 animate-spin' aria-hidden />
              {t('friendship.loading')}
            </Button>
          ) : (
            <>
              <Button className='flex-1' disabled={busy} onClick={addOrAccept}>
                <CheckIcon className='shrink-0' aria-hidden />
                {t('friendship.accept')}
              </Button>
              <Button variant='destructive' disabled={busy} onClick={decline}>
                <XIcon className='shrink-0' aria-hidden />
                {t('friendship.decline')}
              </Button>
            </>
          )}
        </div>
      ) : (
        <Button className='gap-2' disabled={busy} onClick={addOrAccept}>
          {busy ? (
            <>
              <Loader2Icon className='shrink-0 animate-spin' aria-hidden />
              {t('friendship.adding')}
            </>
          ) : (
            <>
              <UserPlus2Icon className='shrink-0' aria-hidden />
              {t('friendship.addFriend')}
            </>
          )}
        </Button>
      )}

      {showFullProfileButton && (
        <Button variant='outline' className='gap-2' asChild>
          <Link
            href={profile?.username ? `/app/u/${profile.username}` : '#'}
            onClick={onCloseAction}
          >
            <ExternalLinkIcon className='size-4' aria-hidden />
            {t('friendship.viewFullProfile')}
          </Link>
        </Button>
      )}
    </div>
  );
}
