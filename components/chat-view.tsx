'use client';

import { endRandomChat } from '@/app/actions/match';
import { reportUser } from '@/app/actions/report';
import { ChatRoom } from '@/components/chat-room';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserAvatar } from '@/components/user-avatar';
import { UserPreviewDialog } from '@/components/user-preview';
import { useChatHeader } from '@/hooks/use-chat-header';
import type { ChatMessage, ChatType } from '@/lib/types';
import { ArrowLeft, Flag, LogOut, MoreVertical, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

export function ChatView({
  chatId,
  type,
  title,
  subtitle,
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
  subtitle: string;
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

    function handleBeforeUnload() {
      beaconEnd();
    }

    // Changed from 'pagehide' to 'beforeunload' so tabbing out doesn't kill the chat
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      beaconEnd();
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
    try {
      await reportUser({ chatId });
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
      <header className='border-border bg-background flex items-center gap-3 border-b px-4 py-3 sm:px-6'>
        <Button
          variant='ghost'
          size='icon'
          className='shrink-0 md:hidden'
          onClick={() => router.back()}
          aria-label='Back'
        >
          <ArrowLeft className='size-5' aria-hidden />
        </Button>
        <button
          type='button'
          onClick={() => canPreview && setPreviewUserId(partnerId)}
          disabled={!canPreview}
          className='flex min-w-0 flex-1 items-center gap-3 text-left enabled:hover:opacity-80'
        >
          <UserAvatar name={title} image={partnerImage} className='shrink-0' />
          <div className='min-w-0 flex-1'>
            <h1 className='truncate leading-tight font-semibold'>{title}</h1>
            <div className='flex items-center gap-2'>
              <p className='text-muted-foreground truncate text-xs'>
                {subtitle}
              </p>
              {isGroup && memberCount != null && (
                <Badge
                  variant='secondary'
                  className='h-5 gap-1 px-1.5 text-[11px]'
                >
                  <span
                    className='bg-primary size-1.5 rounded-full'
                    aria-hidden
                  />
                  {memberCount} online
                </Badge>
              )}
              {ended && (
                <Badge variant='outline' className='h-5 px-1.5 text-[11px]'>
                  Ended
                </Badge>
              )}
            </div>
          </div>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant='ghost'
                size='icon'
                className='shrink-0'
                aria-label='Chat options'
              />
            }
          >
            <MoreVertical className='size-5' aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end' className='w-48'>
            {canPreview && (
              <DropdownMenuItem onClick={() => setPreviewUserId(partnerId)}>
                <Users className='size-4' aria-hidden />
                View profile
              </DropdownMenuItem>
            )}
            {!isGroup && (
              <DropdownMenuItem onClick={handleReport}>
                <Flag className='size-4' aria-hidden />
                Report user
              </DropdownMenuItem>
            )}
            {isRandom && (
              <DropdownMenuItem
                onClick={handleEndChat}
                disabled={leaving}
                className='text-destructive focus:text-destructive'
              >
                <LogOut className='size-4' aria-hidden />
                End chat
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Partner-disconnected banner for random chats */}
      {isRandom && ended && (
        <div className='border-border bg-secondary/60 text-secondary-foreground border-b px-4 py-2 text-center text-sm sm:px-6'>
          {partnerLeft ? `${title} disconnected. ` : 'This chat has ended. '}
          <button
            type='button'
            onClick={() => router.push('/app/match')}
            className='text-primary font-medium hover:underline'
          >
            Find a new match
          </button>
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
        onClose={() => setPreviewUserId(null)}
      />
    </div>
  );
}
