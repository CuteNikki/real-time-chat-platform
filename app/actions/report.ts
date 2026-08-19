'use server';

import { and, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { chatParticipant, report } from '@/lib/db/schema';
import { newId } from '@/lib/id';
import { getCurrentUser } from '@/lib/session';

// Report a user
export async function reportUser({
  reportedUserId,
  chatId,
  reason,
}: {
  reportedUserId: string;
  chatId?: string;
  reason?: string;
}) {
  const me = await getCurrentUser();

  if (me.id === reportedUserId) {
    throw new Error('You cannot report yourself');
  }

  // If a chatId is provided, optionally verify the reporter is actually in that chat.
  if (chatId) {
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
  }

  await db.insert(report).values({
    id: newId('rep'),
    reporterId: me.id,
    reportedUserId,
    chatId: chatId ?? null,
    reason: reason ?? null,
  });

  return { ok: true };
}
