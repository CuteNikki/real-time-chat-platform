'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { Loader2Icon, ShuffleIcon, SparklesIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  cancelMatch,
  checkMatchStatus,
  requestMatch,
} from '@/app/actions/match';

import { EVENTS, userChannel } from '@/lib/pusher/channels';
import { acquireChannel, releaseChannel } from '@/lib/pusher/client';

import { Button } from '@/components/ui/button';

export function MatchFinder({ userId }: { userId: string }) {
  const router = useRouter();
  const { t } = useTranslation();
  const [status, setStatus] = useState<'idle' | 'searching' | 'matched'>(
    'idle',
  );
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const goToChat = useCallback(
    (chatId: string, partnerName?: string) => {
      setStatus('matched');
      if (partnerName)
        toast.success(t('match.matchedWith', { name: partnerName }));
      router.push(`/app/chat/${chatId}`);
    },
    [router, t],
  );

  // Realtime: partner-side match notification. Use the reference-counted
  // channel helpers so leaving this page doesn't unsubscribe the shared
  // per-user channel out from under the call listener / notification bell.
  useEffect(() => {
    const channel = acquireChannel(userChannel(userId));
    const onMatch = (data: { chatId: string; partnerName: string }) => {
      goToChat(data.chatId, data.partnerName);
    };
    channel.bind(EVENTS.MATCH_FOUND, onMatch);
    return () => {
      channel.unbind(EVENTS.MATCH_FOUND, onMatch);
      releaseChannel(userChannel(userId));
    };
  }, [userId, goToChat]);

  // Poll fallback while searching.
  useEffect(() => {
    if (status !== 'searching') {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    pollRef.current = setInterval(async () => {
      try {
        const res = await checkMatchStatus();
        if (res.status === 'matched') goToChat(res.chatId);
      } catch {
        // ignore transient errors
      }
    }, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [status, goToChat]);

  // Clean up the queue if the user leaves the page while searching.
  useEffect(() => {
    return () => {
      if (status === 'searching') cancelMatch().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function start() {
    setBusy(true);
    try {
      const res = await requestMatch();
      if (res.status === 'matched') {
        goToChat(res.chatId, res.partnerName);
      } else {
        setStatus('searching');
      }
    } catch {
      toast.error(t('match.couldNotStart'));
    } finally {
      setBusy(false);
    }
  }

  async function stop() {
    setBusy(true);
    try {
      await cancelMatch();
      setStatus('idle');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className='xs:p-6 mx-auto flex min-h-full w-full max-w-lg flex-col items-center justify-center gap-4 p-4 text-center'>
      <div className='bg-muted ring-border/60 relative mb-4 flex size-20 shrink-0 items-center justify-center rounded-2xl ring-1'>
        {status === 'searching' ? (
          <>
            <span className='bg-primary/15 absolute inline-flex size-20 animate-ping rounded-2xl' />
            <Loader2Icon
              className='text-primary size-9 animate-spin'
              aria-hidden
            />
          </>
        ) : (
          <ShuffleIcon className='text-primary size-9 shrink-0' aria-hidden />
        )}
      </div>

      {status === 'searching' ? (
        <div className='flex flex-col items-center gap-2'>
          <span className='text-3xl font-semibold tracking-tight'>
            {t('match.findingTitle')}
          </span>
          <p className='text-muted-foreground max-w-sm text-balance'>
            {t('match.findingDesc')}
          </p>
          <Button
            variant='outline'
            size='lg'
            onClick={stop}
            disabled={busy}
            className='mt-2'
          >
            {t('match.cancel')}
          </Button>
        </div>
      ) : (
        <div className='flex flex-col items-center gap-2'>
          <span className='text-3xl font-semibold tracking-tight text-balance'>
            {t('match.meetTitle')}
          </span>
          <p className='text-muted-foreground max-w-sm text-pretty'>
            {t('match.meetDesc')}
          </p>
          <Button size='lg' onClick={start} disabled={busy} className='mt-2'>
            <SparklesIcon aria-hidden />
            {busy ? t('match.searching') : t('match.findMatch')}
          </Button>
        </div>
      )}
    </div>
  );
}
