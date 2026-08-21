import 'server-only';

import { aliasedTable, and, eq } from 'drizzle-orm';

import { notify } from '@/app/actions/notifications';
import { db } from '@/lib/db';
import { chat, chatParticipant, message } from '@/lib/db/schema';
import { newId } from '@/lib/id';
import { chatChannel, EVENTS } from '@/lib/pusher/channels';
import { pusherServer } from '@/lib/pusher/server';
import {
  ensureSystemUser,
  SYSTEM_NAME,
  SYSTEM_USER_ID,
  SYSTEM_USERNAME,
} from '@/lib/system-user';
import type { ChatMessage, SystemMessageMeta } from '@/lib/types';

// Find the existing 1-on-1 PRIVATE chat between the System account and `userId`,
// or create it. There is at most one: a self-join on chat_participant pins the
// PRIVATE chat that has both the user and System as members. Created chats mirror
// the DM shape used elsewhere (invites.ts) — a PRIVATE chat with two active
// participant rows — so it surfaces in the normal messages list.
async function getOrCreateSystemChat(userId: string): Promise<string> {
  const meP = aliasedTable(chatParticipant, 'me_p');
  const sysP = aliasedTable(chatParticipant, 'sys_p');
  const [existing] = await db
    .select({ chatId: chat.id })
    .from(chat)
    .innerJoin(meP, and(eq(meP.chatId, chat.id), eq(meP.userId, userId)))
    .innerJoin(
      sysP,
      and(eq(sysP.chatId, chat.id), eq(sysP.userId, SYSTEM_USER_ID)),
    )
    .where(eq(chat.type, 'PRIVATE'))
    .limit(1);
  if (existing) return existing.chatId;

  const chatId = newId('chat');
  await db.insert(chat).values({ id: chatId, type: 'PRIVATE', name: null });
  await db.insert(chatParticipant).values([
    { id: newId('cp'), chatId, userId },
    { id: newId('cp'), chatId, userId: SYSTEM_USER_ID },
  ]);
  return chatId;
}

// Send an automated DM from the System account to `userId`. `meta` carries the
// structured event (report receipt, review outcome, moderation notice) that the
// client renders into a centered notice; `previewText` is a short human string
// stored as the message content so the messages-list preview and the resulting
// MESSAGE notification read naturally.
//
// Because a System DM is a real new message, it also fires the normal MESSAGE
// notification path (unless the recipient already has the thread open), so the
// bell + toast light up without any extra wiring. Never throws into the caller.
export async function sendSystemDM(
  userId: string,
  meta: SystemMessageMeta,
  previewText: string,
): Promise<void> {
  try {
    // System can't DM itself (e.g. a moderator resolving a report about System).
    if (userId === SYSTEM_USER_ID) return;

    await ensureSystemUser();
    const chatId = await getOrCreateSystemChat(userId);

    const id = newId('msg');
    const createdAt = new Date();
    await db.insert(message).values({
      id,
      chatId,
      senderId: SYSTEM_USER_ID,
      kind: 'SYSTEM',
      meta,
      content: previewText,
      createdAt,
    });

    const payload: ChatMessage = {
      id,
      chatId,
      senderId: SYSTEM_USER_ID,
      senderName: SYSTEM_NAME,
      senderImage: null,
      kind: 'SYSTEM',
      meta,
      content: previewText,
      imageUrl: null,
      replyToId: null,
      replyTo: null,
      editedAt: null,
      deletedAt: null,
      createdAt: createdAt.toISOString(),
    };
    await pusherServer.trigger(chatChannel(chatId), EVENTS.NEW_MESSAGE, payload);

    // Skip the inbox notification if the recipient already has this thread open
    // (they see the notice land live). Fail open — notify on any lookup error.
    let present = false;
    try {
      const res = await pusherServer.get({
        path: `/channels/${chatChannel(chatId)}/users`,
      });
      const data = (await res.json()) as { users?: { id: string }[] };
      present = (data.users ?? []).some((u) => u.id === userId);
    } catch {
      present = false;
    }

    if (!present) {
      await notify({
        recipientId: userId,
        actorId: SYSTEM_USER_ID,
        type: 'MESSAGE',
        targetId: chatId,
        category: 'directMessage',
        metadata: { preview: previewText, chatType: 'PRIVATE' },
        actor: { name: SYSTEM_NAME, username: SYSTEM_USERNAME, image: null },
      });
    }
  } catch (err) {
    console.log(
      '[system] sendSystemDM failed:',
      err instanceof Error ? err.message : err,
    );
  }
}
