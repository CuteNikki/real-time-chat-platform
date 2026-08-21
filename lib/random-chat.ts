import { and, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { chat, chatParticipant, message } from '@/lib/db/schema';
import { chatChannel, EVENTS } from '@/lib/pusher/channels';
import { pusherServer } from '@/lib/pusher/server';

export type TeardownResult =
  | 'ended'
  | 'not-member'
  | 'not-found'
  | 'not-random';

// Tear down an ephemeral RANDOM match: verify the caller is a participant,
// notify the partner via CHAT_ENDED so their view flips to "disconnected",
// then delete the messages, participants, and chat row. Shared by the
// `endRandomChat` server action (explicit "End chat") and the /api/match/end
// beacon route (tab close / unmount). Returns a status so each caller can
// shape its own response — throw vs HTTP code. Deleting a non-RANDOM chat here
// would be a footgun, so the type is checked before anything is destroyed.
export async function teardownRandomChat(
  chatId: string,
  actor: { id: string; name: string },
): Promise<TeardownResult> {
  const [membership] = await db
    .select()
    .from(chatParticipant)
    .where(
      and(
        eq(chatParticipant.chatId, chatId),
        eq(chatParticipant.userId, actor.id),
      ),
    )
    .limit(1);
  if (!membership) return 'not-member';

  const [c] = await db.select().from(chat).where(eq(chat.id, chatId)).limit(1);
  if (!c) return 'not-found';
  if (c.type !== 'RANDOM') return 'not-random';

  await pusherServer.trigger(chatChannel(chatId), EVENTS.CHAT_ENDED, {
    by: actor.name,
    disconnected: true,
  });
  await db.delete(message).where(eq(message.chatId, chatId));
  await db.delete(chatParticipant).where(eq(chatParticipant.chatId, chatId));
  await db.delete(chat).where(eq(chat.id, chatId));
  return 'ended';
}
