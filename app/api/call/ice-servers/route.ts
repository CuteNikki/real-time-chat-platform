import { NextResponse } from 'next/server';

import { getCurrentUserOrNull } from '@/lib/session';

// ICE server configuration for the browser's RTCPeerConnection. Served from an
// auth-gated route (rather than baked into the client bundle) so the TURN
// credentials stay server-side and can later be swapped for short-lived,
// per-session tokens without touching the client.
//
// Public STUN alone lets most peers discover each other; a TURN relay is the
// fallback for the ~10-20% of networks (symmetric NAT, strict firewalls) where
// a direct path can't be established. TURN is optional here — if the env vars
// aren't set we just return STUN.
export async function GET() {
  const user = await getCurrentUserOrNull();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const iceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
  ];

  const turnUrl = process.env.TURN_URL;
  if (turnUrl) {
    iceServers.push({
      urls: turnUrl.split(',').map((u) => u.trim()).filter(Boolean),
      username: process.env.TURN_USERNAME,
      credential: process.env.TURN_CREDENTIAL,
    });
  }

  // The config is per-deployment (not per-user), but it's behind auth and may
  // become per-session later, so keep it uncached.
  return NextResponse.json(
    { iceServers },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
