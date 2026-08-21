'use server';

import { and, eq, isNull } from 'drizzle-orm';

import { db } from '@/lib/db';
import { chat, chatParticipant, message } from '@/lib/db/schema';
import { newId } from '@/lib/id';
import { chatChannel, EVENTS, userChannel } from '@/lib/pusher/channels';
import { pusherServer } from '@/lib/pusher/server';
import { getCurrentUser } from '@/lib/session';
import type {
  CallMedia,
  CallOutcome,
  ChatMessage,
  SystemMessageMeta,
} from '@/lib/types';

// The signaling events this action is allowed to relay — exactly the CALL_*
// entries in EVENTS. Kept strict so a caller can't push arbitrary events onto
// someone else's private channel.
type CallSignalEvent =
  | typeof EVENTS.CALL_OFFER
  | typeof EVENTS.CALL_ANSWER
  | typeof EVENTS.CALL_ICE
  | typeof EVENTS.CALL_DECLINE
  | typeof EVENTS.CALL_CANCEL
  | typeof EVENTS.CALL_END
  | typeof EVENTS.CALL_BUSY
  | typeof EVENTS.CALL_VIDEO;

const CALL_EVENTS: readonly CallSignalEvent[] = [
  EVENTS.CALL_OFFER,
  EVENTS.CALL_ANSWER,
  EVENTS.CALL_ICE,
  EVENTS.CALL_DECLINE,
  EVENTS.CALL_CANCEL,
  EVENTS.CALL_END,
  EVENTS.CALL_BUSY,
  EVENTS.CALL_VIDEO,
];

// Relay one WebRTC signaling message (offer/answer/ICE/control) to the other
// party's per-user private channel. A single guarded action handles every
// signal type and works identically for DM and RANDOM chats, since "may A call
// B" reduces to "do A and B share an active participant row in this chat".
//
// The caller's identity is stamped server-side from the session (never trusted
// from the payload), so a CALL_OFFER can't spoof who's ringing.
export async function sendCallSignal(input: {
  chatId: string;
  toUserId: string;
  event: CallSignalEvent;
  // The event-specific body (sdp / candidate / callId). `from` is injected
  // here, so anything the client sets for it is ignored.
  payload: Record<string, unknown>;
}) {
  const user = await getCurrentUser();

  if (!CALL_EVENTS.includes(input.event)) {
    throw new Error('Invalid call signal');
  }
  if (input.toUserId === user.id) {
    throw new Error('Cannot call yourself');
  }
  if (typeof input.payload?.callId !== 'string' || !input.payload.callId) {
    throw new Error('Missing call id');
  }

  // The chat must exist and still be live.
  const [c] = await db
    .select({ endedAt: chat.endedAt })
    .from(chat)
    .where(eq(chat.id, input.chatId))
    .limit(1);
  if (!c || c.endedAt) {
    throw new Error('Chat unavailable');
  }

  // Both the caller and the callee must be current (not-left) participants of
  // this chat. One query fetches the active roster; we check membership of both.
  const rows = await db
    .select({ userId: chatParticipant.userId })
    .from(chatParticipant)
    .where(
      and(
        eq(chatParticipant.chatId, input.chatId),
        isNull(chatParticipant.leftAt),
      ),
    );
  const active = new Set(rows.map((r) => r.userId));
  if (!active.has(user.id) || !active.has(input.toUserId)) {
    throw new Error('Not in this chat');
  }

  const from = {
    id: user.id,
    name: user.name,
    image: user.image ?? null,
  };

  try {
    await pusherServer.trigger(userChannel(input.toUserId), input.event, {
      ...input.payload,
      from,
    });
  } catch (err) {
    console.error(`[call] relay ${input.event} trigger failed:`, err);
    throw err;
  }

  return { ok: true as const };
}

// Compose the short, denormalized preview stored on a call-summary message's
// `content`. The authoritative record is the structured `meta` (media/outcome/
// duration) which the client renders into a centered notice — this string only
// feeds the messages-list "last message" preview so it reads naturally there.
function callSummaryPreview(
  media: CallMedia,
  outcome: CallOutcome,
  durationSec: number,
): string {
  const noun = media === 'VIDEO' ? 'Video call' : 'Voice call';
  if (outcome === 'MISSED') return `Missed ${noun.toLowerCase()}`;
  if (outcome === 'DECLINED') return `${noun} declined`;
  const total = Math.max(0, Math.floor(durationSec));
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${noun} · ${mm}:${ss.toString().padStart(2, '0')}`;
}

// Post an in-chat call summary as a SYSTEM message into the DM/random chat the
// call happened in. Per the product decision, a call summary lives in the
// conversation itself — it is NOT a System-account DM and raises NO inbox
// notification. Only the caller posts (see the hook), so there is exactly one
// summary per call.
//
// Unlike sending a normal message, this is allowed even after the chat has
// ended (a random match commonly ends right as the call wraps up), so it only
// checks that the author is a participant — not that the chat is still live.
export async function postCallSummary(input: {
  chatId: string;
  media: CallMedia;
  outcome: CallOutcome;
  durationSec: number;
}): Promise<{ ok: true } | { ok: false }> {
  try {
    const user = await getCurrentUser();

    // The author must be a participant of this chat (ever — left/ended is fine).
    const [membership] = await db
      .select({ userId: chatParticipant.userId })
      .from(chatParticipant)
      .where(
        and(
          eq(chatParticipant.chatId, input.chatId),
          eq(chatParticipant.userId, user.id),
        ),
      )
      .limit(1);
    if (!membership) return { ok: false };

    const media: CallMedia = input.media === 'VIDEO' ? 'VIDEO' : 'VOICE';
    const outcome: CallOutcome =
      input.outcome === 'COMPLETED'
        ? 'COMPLETED'
        : input.outcome === 'DECLINED'
          ? 'DECLINED'
          : 'MISSED';
    const durationSec =
      outcome === 'COMPLETED' ? Math.max(0, Math.floor(input.durationSec)) : 0;

    const meta: SystemMessageMeta = {
      kind: 'CALL',
      media,
      outcome,
      durationSec,
    };
    const preview = callSummaryPreview(media, outcome, durationSec);

    const id = newId('msg');
    const createdAt = new Date();
    await db.insert(message).values({
      id,
      chatId: input.chatId,
      senderId: user.id,
      kind: 'SYSTEM',
      meta,
      content: preview,
      createdAt,
    });

    const payload: ChatMessage = {
      id,
      chatId: input.chatId,
      senderId: user.id,
      senderName: user.name,
      senderImage: user.image ?? null,
      kind: 'SYSTEM',
      meta,
      content: preview,
      imageUrl: null,
      replyToId: null,
      replyTo: null,
      editedAt: null,
      deletedAt: null,
      createdAt: createdAt.toISOString(),
    };
    await pusherServer.trigger(
      chatChannel(input.chatId),
      EVENTS.NEW_MESSAGE,
      payload,
    );

    return { ok: true };
  } catch (err) {
    console.log(
      '[call] postCallSummary failed:',
      err instanceof Error ? err.message : err,
    );
    return { ok: false };
  }
}

