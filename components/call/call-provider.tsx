'use client';

import { createContext, useContext, useEffect } from 'react';

import { EVENTS, userChannel } from '@/lib/pusher/channels';
import { acquireChannel, releaseChannel } from '@/lib/pusher/client';
import type { CallPeer } from '@/lib/types';

import { CallOverlay } from '@/components/call/call-overlay';
import { useWebRTCCall, type WebRTCCall } from '@/hooks/use-webrtc-call';

const CallContext = createContext<WebRTCCall | null>(null);

// Access the global call controller. `startCall(chatId, partner, { video })`
// begins a 1-on-1 call; the overlay + ringing UI are rendered by the provider.
export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall must be used within <CallProvider>');
  return ctx;
}

export function CallProvider({
  user,
  children,
}: {
  user: CallPeer;
  children: React.ReactNode;
}) {
  const call = useWebRTCCall(user);
  const { handleSignal } = call;

  // Listen for inbound call signals on our own private channel — the same
  // per-user channel the notification bell and match finder use. We go through
  // the reference-counted acquire/release helpers (never a raw subscribe) so
  // that when another consumer on this channel unmounts, Pusher doesn't tear the
  // whole channel down and orphan our binding — which otherwise made incoming
  // calls silently stop ringing until a full page refresh. Since this provider
  // lives in the app layout for the whole session, it also keeps the channel
  // alive for every other consumer.
  useEffect(() => {
    const channel = acquireChannel(userChannel(user.id));
    const events = [
      EVENTS.CALL_OFFER,
      EVENTS.CALL_ANSWER,
      EVENTS.CALL_ICE,
      EVENTS.CALL_DECLINE,
      EVENTS.CALL_CANCEL,
      EVENTS.CALL_END,
      EVENTS.CALL_BUSY,
      EVENTS.CALL_VIDEO,
    ] as const;
    const handlers = events.map((event) => {
      const fn = (payload: unknown) => handleSignal(event, payload);
      channel.bind(event, fn);
      return [event, fn] as const;
    });
    return () => {
      for (const [event, fn] of handlers) channel.unbind(event, fn);
      releaseChannel(userChannel(user.id));
    };
  }, [user.id, handleSignal]);

  return (
    <CallContext.Provider value={call}>
      {children}
      {call.status !== 'idle' ? <CallOverlay call={call} /> : null}
    </CallContext.Provider>
  );
}
