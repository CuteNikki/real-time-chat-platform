'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { Loader2Icon, ShuffleIcon, SparklesIcon } from 'lucide-react';

import {
  cancelMatch,
  checkMatchStatus,
  requestMatch,
} from '@/app/actions/match';

import { EVENTS, userChannel } from '@/lib/pusher/channels';
import { getPusherClient } from '@/lib/pusher/client';

import { Button } from '@/components/ui/button';

export function MatchFinder({ userId }: { userId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'searching' | 'matched'>(
    'idle',
  );
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const goToChat = useCallback(
    (chatId: string, partnerName?: string) => {
      setStatus('matched');
      if (partnerName) toast.success(`Matched with ${partnerName}!`);
      router.push(`/app/chat/${chatId}`);
    },
    [router],
  );

  // Realtime: partner-side match notification.
  useEffect(() => {
    const pusher = getPusherClient();
    const channel = pusher.subscribe(userChannel(userId));
    const onMatch = (data: { chatId: string; partnerName: string }) => {
      goToChat(data.chatId, data.partnerName);
    };
    channel.bind(EVENTS.MATCH_FOUND, onMatch);
    return () => {
      channel.unbind(EVENTS.MATCH_FOUND, onMatch);
      pusher.unsubscribe(userChannel(userId));
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
      toast.error('Could not start matching. Try again.');
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
      <div className='bg-accent relative mb-4 flex size-28 shrink-0 items-center justify-center rounded-full'>
        {status === 'searching' ? (
          <>
            <span className='bg-primary/20 absolute inline-flex size-28 animate-ping rounded-full' />
            <Loader2Icon
              className='text-primary size-12 animate-spin'
              aria-hidden
            />
          </>
        ) : (
          <ShuffleIcon className='text-primary size-12 shrink-0' aria-hidden />
        )}
      </div>

      {status === 'searching' ? (
        <div className='flex flex-col items-center gap-2'>
          <span className='text-3xl font-semibold tracking-tight'>
            Finding Someone…
          </span>
          <p className='text-muted-foreground max-w-sm text-balance'>
            Hang tight - we'll drop you into a chat the moment we find a match.
          </p>
          <Button
            variant='outline'
            size='lg'
            onClick={stop}
            disabled={busy}
            className='mt-2'
          >
            Cancel
          </Button>
        </div>
      ) : (
        <div className='flex flex-col items-center gap-2'>
          <span className='text-3xl font-semibold tracking-tight text-balance'>
            Meet Someone New
          </span>
          <p className='text-muted-foreground max-w-sm text-pretty'>
            Tap below and we'll pair you one-on-one with another person who's
            ready to chat right now.
          </p>
          <Button size='lg' onClick={start} disabled={busy} className='mt-2'>
            <SparklesIcon aria-hidden />
            {busy ? 'Searching…' : 'Find a Match'}
          </Button>
        </div>
      )}
    </div>
  );
}
