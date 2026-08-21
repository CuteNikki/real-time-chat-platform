import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { teardownRandomChat } from '@/lib/random-chat';

// Beacon-friendly end endpoint for RANDOM (1-on-1 match) chats. Called when a
// user navigates away, closes the tab, or the chat unmounts. Shares its teardown
// logic with the `endRandomChat` server action via teardownRandomChat.
export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ ok: false }, { status: 401 });

  let chatId: string | null = null;
  try {
    const body = await req.json();
    chatId = typeof body?.chatId === 'string' ? body.chatId : null;
  } catch {
    // ignore parse failures from sendBeacon Blob
  }
  if (!chatId) return NextResponse.json({ ok: false }, { status: 400 });

  const result = await teardownRandomChat(chatId, {
    id: session.user.id,
    name: session.user.name,
  });
  if (result === 'not-member') {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  // 'not-found' / 'not-random' are treated as success — the match is already
  // gone (or was never a match), so there's nothing for the caller to retry.
  return NextResponse.json({ ok: true });
}
