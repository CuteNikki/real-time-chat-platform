'use server';

import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chat, chatParticipant, randomQueue } from '@/lib/db/schema';
import { getCurrentUser } from '@/lib/session';
import { pusherServer } from '@/lib/pusher/server';
import { userChannel, EVENTS } from '@/lib/pusher/channels';
import { newId } from '@/lib/id';
import { teardownRandomChat } from '@/lib/random-chat';

type MatchResult =
  | { status: 'matched'; chatId: string; partnerName: string }
  | { status: 'waiting' };

// Try to pair the current user with someone already waiting. If nobody is
// waiting, enqueue the user. Uses SKIP LOCKED so two simultaneous requests
// never grab the same waiting partner.
export async function requestMatch(): Promise<MatchResult> {
  const me = await getCurrentUser();

  return db.transaction(async (tx) => {
    // Prefer a waiting user who shares the most interest tags with me; break
    // ties by who has waited longest. Falls back to plain FIFO when nobody
    // shares an interest. SKIP LOCKED keeps concurrent matches from colliding.
    const waiting = await tx.execute(
      sql`SELECT q."id", q."userId",
                 (SELECT count(*) FROM "interest" oi
                  WHERE oi."userId" = q."userId"
                    AND oi."tag" IN (SELECT "tag" FROM "interest" WHERE "userId" = ${me.id})
                 ) AS shared
          FROM "random_queue" q
          WHERE q."userId" <> ${me.id}
          ORDER BY shared DESC, q."joinedAt" ASC
          LIMIT 1
          FOR UPDATE SKIP LOCKED`,
    );

    const partner = waiting.rows[0] as
      { id: string; userId: string } | undefined;

    if (partner) {
      // Remove partner from queue and make sure I'm not queued either.
      await tx
        .delete(randomQueue)
        .where(eq(randomQueue.userId, partner.userId));
      await tx.delete(randomQueue).where(eq(randomQueue.userId, me.id));

      // Create the chat + both participants.
      const chatId = newId('chat');
      await tx.insert(chat).values({ id: chatId, type: 'RANDOM', name: null });
      await tx.insert(chatParticipant).values([
        { id: newId('cp'), chatId, userId: me.id },
        { id: newId('cp'), chatId, userId: partner.userId },
      ]);

      // Look up partner name for both notifications.
      const partnerRow = await tx.execute(
        sql`SELECT "name" FROM "user" WHERE "id" = ${partner.userId} LIMIT 1`,
      );
      const partnerName =
        (partnerRow.rows[0] as { name: string } | undefined)?.name ?? 'Someone';

      // Notify the waiting partner in real time so they navigate in.
      await pusherServer.trigger(
        userChannel(partner.userId),
        EVENTS.MATCH_FOUND,
        {
          chatId,
          partnerName: me.name,
        },
      );

      return { status: 'matched', chatId, partnerName } as const;
    }

    // Nobody waiting — enqueue me (idempotent).
    await tx
      .insert(randomQueue)
      .values({ id: newId('q'), userId: me.id })
      .onConflictDoNothing({ target: randomQueue.userId });

    return { status: 'waiting' } as const;
  });
}

// Leave the waiting queue (user cancelled before being matched).
export async function cancelMatch() {
  const me = await getCurrentUser();
  await db.delete(randomQueue).where(eq(randomQueue.userId, me.id));
  return { ok: true };
}

// End a random chat: mark it ended, remove both participants, notify the room.
export async function endRandomChat(chatId: string) {
  const me = await getCurrentUser();
  const result = await teardownRandomChat(chatId, { id: me.id, name: me.name });
  if (result === 'not-member') throw new Error('Not a member of this chat');
  return { ok: true };
}

// Poll fallback: has a waiting user been matched into a chat yet?
export async function checkMatchStatus(): Promise<MatchResult> {
  const me = await getCurrentUser();

  // Still in queue → waiting.
  const [queued] = await db
    .select()
    .from(randomQueue)
    .where(eq(randomQueue.userId, me.id))
    .limit(1);
  if (queued) return { status: 'waiting' };

  // Not in queue: find my most recent active RANDOM chat.
  const rows = await db
    .select({ chatId: chat.id })
    .from(chatParticipant)
    .innerJoin(chat, eq(chat.id, chatParticipant.chatId))
    .where(
      and(
        eq(chatParticipant.userId, me.id),
        isNull(chatParticipant.leftAt),
        eq(chat.type, 'RANDOM'),
        isNull(chat.endedAt),
      ),
    )
    .orderBy(sql`${chat.createdAt} DESC`)
    .limit(1);

  if (rows[0])
    return { status: 'matched', chatId: rows[0].chatId, partnerName: '' };
  // Neither queued nor matched (e.g. cancelled elsewhere).
  return { status: 'waiting' };
}
