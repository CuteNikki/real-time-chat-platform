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
  Phone,
  Users2Icon,
  Video,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { endRandomChat } from '@/app/actions/match';

import { postBeacon } from '@/lib/beacon';
import type { ChatMessage } from '@/lib/types';

import { useCall } from '@/components/call/call-provider';
import { ChatRoom } from '@/components/chat/chat-room';
import { ReportDialog } from '@/components/report-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserAvatar } from '@/components/user/user-avatar';
import { UserPreviewDialog } from '@/components/user/user-preview';

// Random-match chat view. Reached only via /app/chat/[chatId] (the match
// finder navigates here); DMs and rooms have their own workspaces. So this is
// always a RANDOM, ephemeral 1-on-1 session — no chat-type branching needed.
export function ChatView({
  chatId,
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
  const { startCall, hangUp } = useCall();
  const { t } = useTranslation();
  const [ended, setEnded] = useState(initialEnded);
  const [partnerLeft, setPartnerLeft] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [previewUserId, setPreviewUserId] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  const stillMountedRef = useRef(false);

  // Whether we've already ended this random chat (so unmount doesn't re-fire).
  const endedRef = useRef(initialEnded);
  useEffect(() => {
    endedRef.current = ended;
  }, [ended]);

  // Beacon end for random chats — survives navigation/tab close.
  const beaconEnd = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    postBeacon('/api/match/end', { chatId });
  }, [chatId]);

  // Auto-end the random match when the user closes the tab or unmounts.
  useEffect(() => {
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
  }, [beaconEnd]);

  async function handleEndChat() {
    setLeaving(true);
    try {
      endedRef.current = true;
      await endRandomChat(chatId);
      toast.success(t('chat.view.chatEnded'));
      router.push('/app/match');
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t('chat.view.somethingWrong'),
      );
      setLeaving(false);
      // Reset the ref so the user can try leaving again if it failed
      endedRef.current = false;
    }
  }

  async function handleReport() {
    if (!partnerId) return;
    setReportOpen(true);
  }

  // When the partner disconnects, the CHAT_ENDED event flips `ended`. If we
  // didn't end it ourselves, it means the partner left.
  function handleEnded(payload?: { by?: string; disconnected?: boolean }) {
    setEnded(true);
    // A random match ending also tears down any call in progress with them.
    hangUp();
    // If we already ended it ourselves, endedRef was set first — so a payload
    // arriving while endedRef was false means the *partner* triggered it.
    if (payload) {
      setPartnerLeft(true);
      toast(t('chat.view.disconnectedToast', { name: payload.by ?? title }));
    }
    endedRef.current = true;
  }

  const canPreview = !!partnerId;
  const canCall = !!partnerId && !ended;

  function call(video: boolean) {
    if (!partnerId) return;
    startCall(
      chatId,
      { id: partnerId, name: title, image: partnerImage },
      {
        video,
      },
    );
  }

  return (
    <div className='flex h-full flex-col'>
      {/* Header */}
      <header className='border-border bg-background flex items-center gap-2 border-b p-2'>
        <Button
          variant='ghost'
          size='icon-lg'
          className='shrink-0'
          onClick={() => router.back()}
          aria-label={t('chat.view.back')}
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
                {t('chat.view.ended')}
              </Badge>
            )}
          </div>
        </Button>

        <Button
          variant='ghost'
          size='icon-lg'
          className='shrink-0'
          onClick={() => call(false)}
          disabled={!canCall}
          aria-label={t('chat.view.startVoice')}
        >
          <Phone className='shrink-0' aria-hidden />
        </Button>
        <Button
          variant='ghost'
          size='icon-lg'
          className='shrink-0'
          onClick={() => call(true)}
          disabled={!canCall}
          aria-label={t('chat.view.startVideo')}
        >
          <Video className='shrink-0' aria-hidden />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant='ghost'
              size='icon-lg'
              aria-label={t('chat.view.options')}
            >
              <MoreVertical className='shrink-0' aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end' className='w-48'>
            {canPreview && (
              <DropdownMenuItem onClick={() => setPreviewUserId(partnerId)}>
                <Users2Icon className='shrink-0' aria-hidden />
                {t('chat.view.viewProfile')}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              variant='destructive'
              onClick={handleReport}
              disabled={!canPreview}
            >
              <Flag className='shrink-0' aria-hidden />
              {t('chat.view.reportUser')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleEndChat}
              disabled={leaving}
              variant='destructive'
            >
              <LogOutIcon className='shrink-0' aria-hidden />
              {t('chat.view.endChat')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Partner-disconnected banner */}
      {ended && (
        <div className='border-border bg-secondary/60 text-secondary-foreground border-b px-4 py-2 text-center text-sm sm:px-6'>
          {partnerLeft
            ? t('chat.view.disconnectedBanner', { name: title })
            : t('chat.view.endedBanner')}{' '}
          <Button variant='link' onClick={() => router.push('/app/match')}>
            {t('chat.view.findNewMatch')}
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
          onEndedAction={handleEnded}
        />
      </div>

      <UserPreviewDialog
        userId={previewUserId}
        onCloseAction={() => setPreviewUserId(null)}
      />

      <ReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        target={
          partnerId ? { reportedUserId: partnerId, name: title, chatId } : null
        }
      />
    </div>
  );
}
