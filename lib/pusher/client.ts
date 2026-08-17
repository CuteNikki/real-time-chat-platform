'use client';

import PusherClient from 'pusher-js';

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
