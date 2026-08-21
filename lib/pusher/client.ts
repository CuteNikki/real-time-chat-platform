'use client';

import PusherClient, { type Channel } from 'pusher-js';

let client: PusherClient | null = null;

// Lazily create a single browser Pusher client. Presence/private channels are
// authorized via /api/pusher/auth.
export function getPusherClient() {
  if (!client) {
    client = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      authEndpoint: '/api/pusher/auth',
    });
  }
  return client;
}

// Reference-counted channel subscriptions. A room's presence channel is shared
// by more than one hook — the message stream (useChat) and the presence roster
// (useRoomMembers). Pusher's own subscribe/unsubscribe is NOT reference
// counted: the first consumer to unsubscribe tears the channel down for
// everyone, and the next subscribe hands back a brand-new channel object,
// orphaning anyone still bound to the old one (its member/message events never
// fire again). These helpers count holders so the channel is only actually
// unsubscribed once the last consumer releases it — until then every consumer
// keeps sharing the same live channel object and its bindings stay valid.
const holders = new Map<string, number>();

export function acquireChannel(name: string): Channel {
  holders.set(name, (holders.get(name) ?? 0) + 1);
  // subscribe() is idempotent: it returns the existing channel if we've already
  // joined, so repeated acquires share one underlying subscription.
  return getPusherClient().subscribe(name);
}

export function releaseChannel(name: string) {
  const next = (holders.get(name) ?? 1) - 1;
  if (next <= 0) {
    holders.delete(name);
    getPusherClient().unsubscribe(name);
  } else {
    holders.set(name, next);
  }
}
