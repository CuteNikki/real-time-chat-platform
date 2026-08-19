'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  Flag,
  LogOutIcon,
  MoreVertical,
  Users2Icon,
} from 'lucide-react';

import { endRandomChat } from '@/app/actions/match';
import { reportUser } from '@/app/actions/report';

import { useChatHeader } from '@/hooks/use-chat-header';

import type { ChatMessage, ChatType } from '@/lib/types';

import { ChatRoom } from '@/components/chat-room';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserAvatar } from '@/components/user-avatar';
import { UserPreviewDialog } from '@/components/user-preview';

export function ChatView({
  chatId,
  type,
  title,
  partnerId,
  partnerImage,
  ended: initialEnded,
  currentUserId,
  currentUserName,
  currentUserImage,
  initialMessages,
}: {
  chatId: string;
  type: ChatType;
  title: string;
  partnerId: string | null;
  partnerImage: string | null;
  ended: boolean;
  currentUserId: string;
  currentUserName: string;
  currentUserImage: string | null;
  initialMessages: ChatMessage[];
}) {
  const router = useRouter();
  const [ended, setEnded] = useState(initialEnded);
  const [partnerLeft, setPartnerLeft] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [previewUserId, setPreviewUserId] = useState<string | null>(null);

  const stillMountedRef = useRef(false);

  // Live presence count for group rooms.
  const { memberCount } = useChatHeader({ chatId, enabled: type === 'GROUP' });

  const isGroup = type === 'GROUP';
  const isRandom = type === 'RANDOM';

  // Mirrors sendMessage's notification categories. Random matches never
  // generate a MESSAGE notification server-side (you're always actively in
  // the session), so there's nothing to chime for here either.
  const notifyCategory = isGroup
    ? 'roomMessage'
    : isRandom
      ? null
      : 'directMessage';

  // Whether we've already ended this random chat (so unmount doesn't re-fire).
  const endedRef = useRef(initialEnded);
  useEffect(() => {
    endedRef.current = ended;
  }, [ended]);

  // Beacon end for random chats — survives navigation/tab close.
  const beaconEnd = useCallback(() => {
    if (!isRandom || endedRef.current) return;
    endedRef.current = true;
    const payload = JSON.stringify({ chatId });

    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon(
        '/api/match/end',
        new Blob([payload], { type: 'application/json' }),
      );
    } else {
      void fetch('/api/match/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      });
    }
  }, [chatId, isRandom]);

  // Auto-end the random match when the user closes the tab or unmounts.
  useEffect(() => {
    if (!isRandom) return;
    stillMountedRef.current = true;
    function handleBeforeUnload() {
      beaconEnd();
    }

    window.addEventListener('pagehide', handleBeforeUnload);
    return () => {
      window.removeEventListener('pagehide', handleBeforeUnload);
      stillMountedRef.current = false;
      setTimeout(() => {
        if (!stillMountedRef.current) beaconEnd();
      }, 0);
    };
  }, [isRandom, beaconEnd]);

  async function handleEndChat() {
    setLeaving(true);
    try {
      endedRef.current = true;
      await endRandomChat(chatId);
      toast.success('Chat ended');
      router.push('/app/match');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
      setLeaving(false);
      // Reset the ref so the user can try leaving again if it failed
      endedRef.current = false;
    }
  }

  async function handleReport() {
    if (!partnerId) return;
    try {
      await reportUser({ chatId, reportedUserId: partnerId });
      toast.success('Report submitted. Thanks for keeping Orbit safe.');
    } catch {
      toast.error('Could not submit report');
    }
  }

  // When the partner disconnects, the CHAT_ENDED event flips `ended`. If we
  // didn't end it ourselves, it means the partner left.
  function handleEnded(payload?: { by?: string; disconnected?: boolean }) {
    setEnded(true);
    // If we already ended it ourselves, endedRef was set first — so a payload
    // arriving while endedRef was false means the *partner* triggered it.
    if (isRandom && payload) {
      setPartnerLeft(true);
      toast(`${payload.by ?? title} disconnected`);
    }
    endedRef.current = true;
  }

  const canPreview = !isGroup && !!partnerId;

  return (
    <div className='flex h-full flex-col'>
      {/* Header */}
      <header className='border-border bg-background flex items-center gap-2 border-b p-2'>
        <Button
          variant='ghost'
          size='icon-lg'
          className='shrink-0'
          onClick={() => router.back()}
          aria-label='Back'
        >
          <ArrowLeftIcon className='shrink-0' aria-hidden />
        </Button>
        <Button
          type='button'
          variant='ghost'
          size='lg'
          onClick={() => canPreview && setPreviewUserId(partnerId)}
          disabled={!canPreview}
          className='flex min-w-0 flex-1 items-center text-left'
        >
          <UserAvatar
            name={title}
            image={partnerImage}
            className='size-6 shrink-0'
          />
          <div className='flex min-w-0 flex-1 gap-2'>
            <span className='truncate leading-tight font-semibold'>
              {title}
            </span>
            {ended && (
              <Badge variant='outline' className='h-5 px-1.5 text-[11px]'>
                Ended
              </Badge>
            )}
          </div>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant='ghost' size='icon-lg' aria-label='Chat options'>
              <MoreVertical className='shrink-0' aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end' className='w-48'>
            {canPreview && (
              <DropdownMenuItem onClick={() => setPreviewUserId(partnerId)}>
                <Users2Icon className='shrink-0' aria-hidden />
                View Profile
              </DropdownMenuItem>
            )}
            <DropdownMenuItem variant='destructive' onClick={handleReport}>
              <Flag className='shrink-0' aria-hidden />
              Report User
            </DropdownMenuItem>
            {isRandom && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleEndChat}
                  disabled={leaving}
                  variant='destructive'
                >
                  <LogOutIcon className='shrink-0' aria-hidden />
                  End Chat
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Partner-disconnected banner for random chats */}
      {isRandom && ended && (
        <div className='border-border bg-secondary/60 text-secondary-foreground border-b px-4 py-2 text-center text-sm sm:px-6'>
          {partnerLeft ? `${title} disconnected. ` : 'This chat has ended. '}
          <Button variant='link' onClick={() => router.push('/app/match')}>
            Find a new match
            <ArrowRightIcon className='shrink-0' aria-hidden />
          </Button>
        </div>
      )}

      {/* Messages + composer */}
      <div className='min-h-0 flex-1'>
        <ChatRoom
          chatId={chatId}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          currentUserImage={currentUserImage}
          initialMessages={initialMessages}
          allowImages={type === 'PRIVATE'}
          showSenderNames={isGroup}
          onUserClickAction={isGroup ? setPreviewUserId : undefined}
          onEndedAction={handleEnded}
          notifyCategory={notifyCategory}
        />
      </div>

      <UserPreviewDialog
        userId={previewUserId}
        onCloseAction={() => setPreviewUserId(null)}
      />
    </div>
  );
}
