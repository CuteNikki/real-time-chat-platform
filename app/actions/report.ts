'use server';

import { and, eq, ne } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chatParticipant, report } from '@/lib/db/schema';
import { getCurrentUser } from '@/lib/session';
import { newId } from '@/lib/id';

// Report the other participant of a 1-on-1 chat.
export async function reportUser({
  chatId,
  reason,
}: {
  chatId: string;
  reason?: string;
}) {
  const me = await getCurrentUser();

  // Confirm the reporter is in the chat.
  const [membership] = await db
    .select()
    .from(chatParticipant)
    .where(
      and(
        eq(chatParticipant.chatId, chatId),
        eq(chatParticipant.userId, me.id),
      ),
    )
    .limit(1);
  if (!membership) throw new Error('Not a member of this chat');

  // Find the other participant.
  const [other] = await db
    .select({ userId: chatParticipant.userId })
    .from(chatParticipant)
    .where(
      and(
        eq(chatParticipant.chatId, chatId),
        ne(chatParticipant.userId, me.id),
      ),
    )
    .limit(1);

  await db.insert(report).values({
    id: newId('rep'),
    reporterId: me.id,
    reportedUserId: other?.userId ?? me.id,
    chatId,
    reason: reason ?? null,
  });

  return { ok: true };
}
