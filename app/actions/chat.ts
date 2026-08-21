'use server';

import { notify } from '@/app/actions/notifications';
import { db } from '@/lib/db';
import { chat, chatParticipant, message, user } from '@/lib/db/schema';
import { newId } from '@/lib/id';
import { chatChannel, EVENTS } from '@/lib/pusher/channels';
import { pusherServer } from '@/lib/pusher/server';
import { getCurrentUser, getUserId } from '@/lib/session';
import type { ChatMessage, ReplyPreview, SystemMessageMeta } from '@/lib/types';
import { INITIAL_MESSAGE_LIMIT, OLDER_MESSAGE_LIMIT } from '@/lib/pagination';
import { aliasedTable, and, desc, eq, gt, isNull, lt, ne } from 'drizzle-orm';

// Self-join aliases used to pull a snapshot of each message's reply target
// (and that target's sender) in the same query, so the quoted preview is
// available even when the original message isn't in the loaded page.
const replyMsg = aliasedTable(message, 'reply_msg');
const replyUser = aliasedTable(user, 'reply_user');

// Shared projection for message rows (+ sender display fields) so every reader
// returns the same shape.
const messageColumns = {
  id: message.id,
  chatId: message.chatId,
  senderId: message.senderId,
  kind: message.kind,
  meta: message.meta,
  content: message.content,
  imageUrl: message.imageUrl,
  replyToId: message.replyToId,
  editedAt: message.editedAt,
  deletedAt: message.deletedAt,
  createdAt: message.createdAt,
  senderName: user.name,
  senderImage: user.image,
  replyToSenderId: replyMsg.senderId,
  replyToContent: replyMsg.content,
  replyToImageUrl: replyMsg.imageUrl,
  replyToDeletedAt: replyMsg.deletedAt,
  replyToSenderName: replyUser.name,
};

type MessageRow = {
  id: string;
  chatId: string;
  senderId: string;
  kind: string;
  meta: SystemMessageMeta | null;
  content: string | null;
  imageUrl: string | null;
  replyToId: string | null;
  editedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  senderName: string | null;
  senderImage: string | null;
  replyToSenderId: string | null;
  replyToContent: string | null;
  replyToImageUrl: string | null;
  replyToDeletedAt: Date | null;
  replyToSenderName: string | null;
};

// Build the reply snapshot from the joined reply-target columns. Null unless
// this message replies to a resolvable target. A soft-deleted target keeps its
// row (so the quote still renders) but its content/image are masked here — the
// retained text lives on only for moderation, never for other readers.
function replyPreviewOf(r: MessageRow): ReplyPreview | null {
  if (!r.replyToId || r.replyToSenderId == null) return null;
  const deleted = r.replyToDeletedAt != null;
  return {
    id: r.replyToId,
    senderId: r.replyToSenderId,
    senderName: r.replyToSenderName ?? 'Unknown',
    content: deleted ? null : r.replyToContent,
    imageUrl: deleted ? null : r.replyToImageUrl,
    deletedAt: r.replyToDeletedAt?.toISOString() ?? null,
  };
}

// Present a stored row for the client. A soft-deleted message now RETAINS its
// content/imageUrl in the database (for 30-day moderation review), so the
// presenter is the single choke point that masks that text back out for every
// normal read/broadcast — a deleted message always renders as an empty tombstone.
function presentMessage(r: MessageRow): ChatMessage {
  const deleted = r.deletedAt != null;
  return {
    id: r.id,
    chatId: r.chatId,
    senderId: r.senderId,
    senderName: r.senderName ?? 'Unknown',
    senderImage: r.senderImage,
    kind: r.kind === 'SYSTEM' ? 'SYSTEM' : 'USER',
    meta: r.meta ?? null,
    content: deleted ? null : r.content,
    imageUrl: deleted ? null : r.imageUrl,
    replyToId: r.replyToId,
    replyTo: replyPreviewOf(r),
    editedAt: r.editedAt?.toISOString() ?? null,
    deletedAt: r.deletedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  };
}

// Throws if the user is not an active participant of the chat.
export async function assertActiveMembership(chatId: string, userId: string) {
  const [row] = await db
    .select()
    .from(chatParticipant)
    .where(
      and(
        eq(chatParticipant.chatId, chatId),
        eq(chatParticipant.userId, userId),
        isNull(chatParticipant.leftAt),
      ),
    )
    .limit(1);
  if (!row) throw new Error('You are not a member of this chat');
}

// Authorize reading/sending in a chat. Group rooms are public drop-in channels
// (any signed-in user may participate; presence tracks who's actually there),
// so they only need to exist and be open. DMs and random matches are private
// 1-on-1s and still require an active participant row.
export async function assertCanAccessChat(chatId: string, userId: string) {
  const [c] = await db
    .select({ type: chat.type, endedAt: chat.endedAt })
    .from(chat)
    .where(eq(chat.id, chatId))
    .limit(1);
  if (!c) throw new Error('Chat not found');
  if (c.type === 'GROUP') {
    if (c.endedAt) throw new Error('This room has ended');
    return;
  }
  await assertActiveMembership(chatId, userId);
}

// The caller's "clear chat" cutoff for a chat, if they've cleared it. Only
// messages strictly newer than this are shown to them. Group rooms have no
// durable participant row for drop-in users, so this simply returns null there.
async function clearedAtFor(
  chatId: string,
  userId: string,
): Promise<Date | null> {
  const [row] = await db
    .select({ clearedAt: chatParticipant.clearedAt })
    .from(chatParticipant)
    .where(
      and(
        eq(chatParticipant.chatId, chatId),
        eq(chatParticipant.userId, userId),
      ),
    )
    .limit(1);
  return row?.clearedAt ?? null;
}

// Clear the conversation for the CALLER only. This used to hard-delete every
// message (wiping both participants' history and the moderation record); now it
// just advances this participant's `clearedAt` marker, so their view resets
// while the other person's history — and any reported message — stays intact.
export async function clearChat(chatId: string) {
  const userId = await getUserId();
  await assertActiveMembership(chatId, userId);
  await db
    .update(chatParticipant)
    .set({ clearedAt: new Date() })
    .where(
      and(
        eq(chatParticipant.chatId, chatId),
        eq(chatParticipant.userId, userId),
      ),
    );
  // Deliberately no CHAT_CLEARED broadcast: clearing is one-sided now, so the
  // caller's own client drops its local history and the other participant is
  // left untouched.
  return { ok: true };
}

// Load the most recent page of a chat's history (newest INITIAL_MESSAGE_LIMIT
// messages), returned oldest-first so it renders top-to-bottom. Older messages
// are pulled in on demand via getOlderMessages as the user scrolls up.
export async function getMessages(
  chatId: string,
  limit = INITIAL_MESSAGE_LIMIT,
): Promise<ChatMessage[]> {
  const userId = await getUserId();
  await assertCanAccessChat(chatId, userId);

  // Respect this reader's own clear-chat cutoff, if any.
  const cleared = await clearedAtFor(chatId, userId);

  const rows: MessageRow[] = await db
    .select(messageColumns)
    .from(message)
    .leftJoin(user, eq(user.id, message.senderId))
    .leftJoin(replyMsg, eq(replyMsg.id, message.replyToId))
    .leftJoin(replyUser, eq(replyUser.id, replyMsg.senderId))
    .where(
      and(
        eq(message.chatId, chatId),
        cleared ? gt(message.createdAt, cleared) : undefined,
      ),
    )
    .orderBy(desc(message.createdAt))
    .limit(limit);

  // Fetched newest-first for the LIMIT; flip back to chronological order.
  return rows.reverse().map(presentMessage);
}

// Load the page of messages immediately older than `beforeCreatedAt` (an ISO
// timestamp — the oldest message the client currently holds). Returned
// oldest-first so the client can prepend the batch as one contiguous block.
export async function getOlderMessages(
  chatId: string,
  beforeCreatedAt: string,
  limit = OLDER_MESSAGE_LIMIT,
): Promise<ChatMessage[]> {
  const userId = await getUserId();
  await assertCanAccessChat(chatId, userId);

  const before = new Date(beforeCreatedAt);
  if (Number.isNaN(before.getTime())) throw new Error('Invalid cursor');

  // Respect this reader's own clear-chat cutoff, if any.
  const cleared = await clearedAtFor(chatId, userId);

  const rows: MessageRow[] = await db
    .select(messageColumns)
    .from(message)
    .leftJoin(user, eq(user.id, message.senderId))
    .leftJoin(replyMsg, eq(replyMsg.id, message.replyToId))
    .leftJoin(replyUser, eq(replyUser.id, replyMsg.senderId))
    .where(
      and(
        eq(message.chatId, chatId),
        lt(message.createdAt, before),
        cleared ? gt(message.createdAt, cleared) : undefined,
      ),
    )
    .orderBy(desc(message.createdAt))
    .limit(limit);

  return rows.reverse().map(presentMessage);
}

export async function sendMessage(input: {
  chatId: string;
  content?: string;
  imageUrl?: string;
  clientId?: string;
  replyToId?: string;
}): Promise<ChatMessage> {
  const currentUser = await getCurrentUser();
  const userId = currentUser.id;
  await assertCanAccessChat(input.chatId, userId);

  const content = input.content?.trim() || null;
  const imageUrl = input.imageUrl || null;
  if (!content && !imageUrl) throw new Error('Message is empty');
  if (content && content.length > 2000) throw new Error('Message too long');

  // Make sure the chat is still active.
  const [c] = await db
    .select()
    .from(chat)
    .where(eq(chat.id, input.chatId))
    .limit(1);
  if (!c) throw new Error('Chat not found');
  if (c.endedAt) throw new Error('This chat has ended');

  // Validate the reply target: it must be a real message in this same chat.
  // Otherwise drop it silently so a stale client can't attach a dangling id.
  // Capture a snapshot of it so the quoted preview travels with the message.
  let replyToId: string | null = null;
  let replyTo: ReplyPreview | null = null;
  if (input.replyToId) {
    const [target] = await db
      .select({
        id: message.id,
        senderId: message.senderId,
        senderName: user.name,
        content: message.content,
        imageUrl: message.imageUrl,
        deletedAt: message.deletedAt,
      })
      .from(message)
      .leftJoin(user, eq(user.id, message.senderId))
      .where(
        and(eq(message.id, input.replyToId), eq(message.chatId, input.chatId)),
      )
      .limit(1);
    if (target) {
      replyToId = target.id;
      const targetDeleted = target.deletedAt != null;
      replyTo = {
        id: target.id,
        senderId: target.senderId,
        senderName: target.senderName ?? 'Unknown',
        content: targetDeleted ? null : target.content,
        imageUrl: targetDeleted ? null : target.imageUrl,
        deletedAt: target.deletedAt?.toISOString() ?? null,
      };
    }
  }

  // Reuse the client-provided id so the sender's optimistic message, the saved
  // row, and the realtime echo all share one id and dedupe cleanly.
  const id = input.clientId || newId('msg');
  const createdAt = new Date();
  await db.insert(message).values({
    id,
    chatId: input.chatId,
    senderId: userId,
    content,
    imageUrl,
    replyToId,
    createdAt,
  });

  const payload: ChatMessage = {
    id,
    chatId: input.chatId,
    senderId: userId,
    senderName: currentUser.name,
    senderImage: currentUser.image ?? null,
    kind: 'USER',
    meta: null,
    content,
    imageUrl,
    replyToId,
    replyTo,
    editedAt: null,
    deletedAt: null,
    createdAt: createdAt.toISOString(),
  };

  await pusherServer.trigger(
    chatChannel(input.chatId),
    EVENTS.NEW_MESSAGE,
    payload,
  );

  // Notify the recipient of a private DM so it lands in their inbox. Group
  // rooms are public drop-in channels with no durable membership, so they don't
  // generate inbox/toast notifications — presence + the in-room chime (see
  // useChat's notifyCategory) cover the "someone's talking here" signal.
  // Random-match chats are excluded too (you're actively in the session).
  if (c.type === 'PRIVATE') {
    const recipients = await db
      .select({ userId: chatParticipant.userId })
      .from(chatParticipant)
      .where(
        and(
          eq(chatParticipant.chatId, input.chatId),
          ne(chatParticipant.userId, userId),
          isNull(chatParticipant.leftAt),
        ),
      );

    // Skip recipients who currently have this chat open — they're subscribed
    // to its presence channel and already see the message land live, so a
    // notification would be redundant. Fail open (notify everyone) if the
    // presence lookup itself fails.
    const presentUserIds = new Set<string>();
    try {
      const res = await pusherServer.get({
        path: `/channels/${chatChannel(input.chatId)}/users`,
      });
      const data = (await res.json()) as { users?: { id: string }[] };
      for (const u of data.users ?? []) presentUserIds.add(u.id);
    } catch (err) {
      console.log(
        '[v0] presence lookup failed, notifying all recipients:',
        err instanceof Error ? err.message : err,
      );
    }

    const preview = content
      ? content.slice(0, 80)
      : imageUrl
        ? 'Sent an image'
        : '';
    // Store structured context only — the recipient's client composes the
    // display ("{sender} messaged you: {preview}") from these fields, so the
    // sender's name is never baked into a string and can't render twice.
    for (const r of recipients) {
      if (presentUserIds.has(r.userId)) continue;
      await notify({
        recipientId: r.userId,
        actorId: userId,
        type: 'MESSAGE',
        // One notification per chat per sender; a new message refreshes it.
        targetId: input.chatId,
        category: 'directMessage',
        metadata: {
          preview,
          chatType: 'PRIVATE',
        },
        actor: {
          name: currentUser.name,
          username: currentUser.username ?? null,
          image: currentUser.image ?? null,
        },
      });
    }
  }

  return payload;
}

// Load one message row and assert the caller owns it and it's still live.
// Shared by edit + delete. Returns the row (with sender display fields) so the
// MESSAGE_UPDATED payload can be composed without a second query.
async function loadOwnLiveMessage(chatId: string, messageId: string, userId: string) {
  const rows: MessageRow[] = await db
    .select(messageColumns)
    .from(message)
    .leftJoin(user, eq(user.id, message.senderId))
    .leftJoin(replyMsg, eq(replyMsg.id, message.replyToId))
    .leftJoin(replyUser, eq(replyUser.id, replyMsg.senderId))
    .where(and(eq(message.id, messageId), eq(message.chatId, chatId)))
    .limit(1);
  const row = rows[0];
  if (!row) throw new Error('Message not found');
  if (row.senderId !== userId) throw new Error('You can only change your own messages');
  if (row.deletedAt) throw new Error('This message was deleted');
  return row;
}

// Edit the text of your own message. Sets editedAt so the UI can show an
// "(edited)" marker, and broadcasts the full updated message so every open
// client swaps it in place. Image-only messages keep their image; text is
// added/replaced as a caption.
export async function editMessage(input: {
  chatId: string;
  messageId: string;
  content: string;
}): Promise<ChatMessage> {
  const userId = await getUserId();
  await assertCanAccessChat(input.chatId, userId);

  const content = input.content.trim();
  if (content.length > 2000) throw new Error('Message too long');

  const row = await loadOwnLiveMessage(input.chatId, input.messageId, userId);
  // A message must still carry something after the edit.
  if (!content && !row.imageUrl) throw new Error('Message is empty');

  const editedAt = new Date();
  await db
    .update(message)
    .set({ content: content || null, editedAt })
    .where(eq(message.id, input.messageId));

  const payload = presentMessage({ ...row, content: content || null, editedAt });

  await pusherServer.trigger(
    chatChannel(input.chatId),
    EVENTS.MESSAGE_UPDATED,
    payload,
  );

  return payload;
}

// Soft-delete your own message: stamp a tombstone but KEEP its content/image in
// the row so a report against it stays verifiable for 30 days. presentMessage
// masks that text for every normal reader, so open clients still render
// "message deleted" in place — the retained copy is moderation-only.
export async function deleteMessage(input: {
  chatId: string;
  messageId: string;
}): Promise<ChatMessage> {
  const userId = await getUserId();
  await assertCanAccessChat(input.chatId, userId);

  const row = await loadOwnLiveMessage(input.chatId, input.messageId, userId);

  const deletedAt = new Date();
  await db
    .update(message)
    .set({ deletedAt })
    .where(eq(message.id, input.messageId));

  const payload = presentMessage({ ...row, deletedAt });

  await pusherServer.trigger(
    chatChannel(input.chatId),
    EVENTS.MESSAGE_UPDATED,
    payload,
  );

  return payload;
}

// Moderation-side soft-delete of ANY message (not just your own). Stamps the
// tombstone if the message is still live, retaining its content for the
// retention window, and broadcasts the masked update so it disappears from open
// clients. Idempotent: a no-op (returns null) if the message is already gone or
// already deleted. Used by moderatorDeleteMessage.
export async function tombstoneMessage(
  chatId: string,
  messageId: string,
): Promise<ChatMessage | null> {
  const rows: MessageRow[] = await db
    .select(messageColumns)
    .from(message)
    .leftJoin(user, eq(user.id, message.senderId))
    .leftJoin(replyMsg, eq(replyMsg.id, message.replyToId))
    .leftJoin(replyUser, eq(replyUser.id, replyMsg.senderId))
    .where(and(eq(message.id, messageId), eq(message.chatId, chatId)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.deletedAt) return presentMessage(row);

  const deletedAt = new Date();
  await db
    .update(message)
    .set({ deletedAt })
    .where(eq(message.id, messageId));

  const payload = presentMessage({ ...row, deletedAt });
  await pusherServer.trigger(
    chatChannel(chatId),
    EVENTS.MESSAGE_UPDATED,
    payload,
  );
  return payload;
}
