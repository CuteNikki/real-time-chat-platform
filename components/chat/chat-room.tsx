'use client';

import type { TFunction } from 'i18next';
import type React from 'react';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import {
  Ban,
  Check,
  CornerUpRight,
  Flag,
  ImagePlusIcon,
  Loader2Icon,
  MoreHorizontal,
  Pencil,
  Phone,
  PhoneMissed,
  Reply,
  SendHorizonal,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Trash2,
  UserCog,
  Video,
  XIcon,
} from 'lucide-react';

import {
  deleteMessage,
  editMessage,
  getOlderMessages,
  sendMessage,
} from '@/app/actions/chat';
import { moderatorDeleteMessage } from '@/app/actions/moderation';

import { useChat } from '@/hooks/use-chat';

import { formatExactTimestamp, formatMessageTime } from '@/lib/format-time';
import { newId } from '@/lib/id';
import { INITIAL_MESSAGE_LIMIT, OLDER_MESSAGE_LIMIT } from '@/lib/pagination';
import type {
  ChatMessage,
  NotificationCategory,
  SystemMessageMeta,
} from '@/lib/types';
import { cn } from '@/lib/utils';

import { ImageLightbox } from '@/components/chat/image-lightbox';
import { ReportDialog, type ReportTarget } from '@/components/report-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { UserAvatar } from '@/components/user/user-avatar';

// Consecutive messages from the same sender within this window collapse into
// one visual group (single avatar + one name/time footer).
const GROUP_WINDOW_MS = 5 * 60 * 1000;

type MessageGroup = {
  senderId: string;
  senderName: string;
  senderImage: string | null;
  mine: boolean;
  items: ChatMessage[];
};

// A rendered row is either a run of same-sender user messages or a single
// SYSTEM notice (call summary / moderation DM), which always stands alone,
// centered, and never joins a sender group.
type Row =
  | { type: 'group'; group: MessageGroup }
  | { type: 'system'; message: ChatMessage };

// A short label for a quoted/replied message.
function previewOf(
  t: TFunction,
  m: Pick<ChatMessage, 'deletedAt' | 'content' | 'imageUrl'>,
): string {
  if (m.deletedAt) return t('chat.room.deletedMessage');
  if (m.content) return m.content;
  if (m.imageUrl) return t('chat.room.photo');
  return t('chat.room.messageLabel');
}

// Human "m:ss" for a call duration.
function formatCallDuration(totalSec: number): string {
  const t = Math.max(0, Math.floor(totalSec));
  const mm = Math.floor(t / 60);
  const ss = t % 60;
  return `${mm}:${ss.toString().padStart(2, '0')}`;
}

// Icon + text for a structured system notice. The message's `meta` is the
// authoritative record; the copy is composed here from its fields (never a
// pre-baked sentence stored on the row).
function describeSystemMeta(
  t: TFunction,
  meta: SystemMessageMeta,
): {
  Icon: typeof Phone;
  text: string;
} {
  switch (meta.kind) {
    case 'CALL': {
      const noun =
        meta.media === 'VIDEO'
          ? t('chat.system.videoCall')
          : t('chat.system.voiceCall');
      if (meta.outcome === 'COMPLETED') {
        return {
          Icon: meta.media === 'VIDEO' ? Video : Phone,
          text: t('chat.system.callCompleted', {
            noun,
            duration: formatCallDuration(meta.durationSec),
          }),
        };
      }
      if (meta.outcome === 'DECLINED') {
        return {
          Icon: PhoneMissed,
          text: t('chat.system.callDeclined', { noun }),
        };
      }
      return {
        Icon: PhoneMissed,
        text:
          meta.media === 'VIDEO'
            ? t('chat.system.missedVideo')
            : t('chat.system.missedVoice'),
      };
    }
    case 'REPORT_FILED':
      return {
        Icon: ShieldAlert,
        text: t('chat.system.reportReceived', { reference: meta.reference }),
      };
    case 'REPORT_RESOLVED':
      return {
        Icon: ShieldCheck,
        text:
          meta.verdict === 'GUILTY'
            ? t('chat.system.reportGuilty', { reference: meta.reference })
            : t('chat.system.reportNoViolation', { reference: meta.reference }),
      };
    case 'PROFILE_RESET':
      return { Icon: UserCog, text: t('chat.system.profileReset') };
    case 'POST_REMOVED':
      return { Icon: Trash2, text: t('chat.system.postRemoved') };
    case 'MESSAGE_REMOVED':
      return { Icon: Trash2, text: t('chat.system.messageRemoved') };
  }
}

// A centered, pill-shaped system notice rendered inline in the message stream.
function SystemNotice({ message }: { message: ChatMessage }) {
  const { t } = useTranslation();
  // Fall back to the stored preview text if meta is somehow absent.
  if (!message.meta) {
    return message.content ? (
      <li className='flex justify-center py-1'>
        <span className='text-muted-foreground bg-muted/60 rounded-full px-3 py-1 text-xs'>
          {message.content}
        </span>
      </li>
    ) : null;
  }
  const { Icon, text } = describeSystemMeta(t, message.meta);
  return (
    <li className='flex justify-center py-1'>
      <span
        className='text-muted-foreground bg-muted/60 flex items-center gap-1.5 rounded-full px-3 py-1 text-xs'
        title={formatExactTimestamp(message.createdAt)}
      >
        <Icon className='size-3.5 shrink-0' aria-hidden />
        {text}
      </span>
    </li>
  );
}

export function ChatRoom({
  chatId,
  currentUserId,
  currentUserName,
  currentUserImage,
  initialMessages,
  allowImages = false,
  showSenderNames = false,
  onEndedAction,
  emptyState,
  onUserClickAction,
  notifyCategory = null,
  canModerate = false,
}: {
  chatId: string;
  currentUserId: string;
  currentUserName: string;
  currentUserImage: string | null;
  initialMessages: ChatMessage[];
  allowImages?: boolean;
  showSenderNames?: boolean;
  onEndedAction?: (payload?: { by?: string; disconnected?: boolean }) => void;
  emptyState?: React.ReactNode;
  // When provided, tapping another user's avatar or name opens their preview.
  onUserClickAction?: (userId: string) => void;
  // Plays this category's chime for a message from someone else while this
  // chat is open. The bell's popup and unread badge already stay quiet for
  // an open chat (the sender skips notifying present recipients), so this is
  // what lets you still hear that a message landed. Pass null (default) for
  // chats that never notify at all, e.g. random matches.
  notifyCategory?: NotificationCategory | null;
  // Moderator/admin surface: offers "Remove message" on other users' messages
  // (independent of any report). The server still enforces the rank rules —
  // a moderator's attempt on an admin's message is rejected there.
  canModerate?: boolean;
}) {
  const { t } = useTranslation();
  const { messages, ended, appendLocal, patchLocal, prependOlder } = useChat({
    chatId,
    currentUserId,
    initialMessages,
    onEnded: onEndedAction,
    notifyCategory,
  });
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  // The message being reported, if any. A non-null target opens the shared
  // ReportDialog pinned to that specific message.
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Scroll bookkeeping. `stickToBottom` tracks whether the viewport is parked
  // at the newest message, so late-loading images or an incoming message keep
  // it pinned without yanking someone who has scrolled up. `restoreHeight`
  // carries the pre-prepend scroll height so we can hold the reading position
  // when older history loads in above. `initialized` makes the first
  // jump-to-bottom instant (no visible scroll animation on open).
  const stickToBottomRef = useRef(true);
  const restoreHeightRef = useRef<number | null>(null);
  const initializedRef = useRef(false);

  const [olderLoading, setOlderLoading] = useState(false);
  const [hasMoreOlder, setHasMoreOlder] = useState(
    initialMessages.length >= INITIAL_MESSAGE_LIMIT,
  );

  // Keep the view pinned to the newest message — except right after prepending
  // older history, when we instead restore the prior reading position. Runs
  // before paint so neither jump is ever visible as a flash.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (restoreHeightRef.current != null) {
      el.scrollTop += el.scrollHeight - restoreHeightRef.current;
      restoreHeightRef.current = null;
      return;
    }
    if (!initializedRef.current) {
      el.scrollTop = el.scrollHeight;
      initializedRef.current = true;
      return;
    }
    if (stickToBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Re-pin to the bottom as images finish loading. Their height isn't known
  // until then, which is what left freshly-opened chats scrolled short.
  function handleImageLoad() {
    const el = scrollRef.current;
    if (el && stickToBottomRef.current && restoreHeightRef.current == null) {
      el.scrollTop = el.scrollHeight;
    }
  }

  // Pull in the next older page and prepend it, holding the reading position.
  async function loadOlder() {
    const el = scrollRef.current;
    const oldest = messages[0];
    if (!el || !oldest || olderLoading || !hasMoreOlder) return;
    setOlderLoading(true);
    restoreHeightRef.current = el.scrollHeight;
    try {
      const batch = await getOlderMessages(chatId, oldest.createdAt);
      setHasMoreOlder(batch.length >= OLDER_MESSAGE_LIMIT);
      if (batch.length > 0) prependOlder(batch);
      else restoreHeightRef.current = null;
    } catch {
      restoreHeightRef.current = null;
      setHasMoreOlder(false);
    } finally {
      setOlderLoading(false);
    }
  }

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (el.scrollTop < 120 && hasMoreOlder && !olderLoading) void loadOlder();
  }

  // Collapse consecutive same-sender user messages into groups; SYSTEM messages
  // break any run and stand alone as their own centered row.
  const rows = useMemo(() => {
    const out: Row[] = [];
    let group: MessageGroup | null = null;
    for (const m of messages) {
      if (m.kind === 'SYSTEM') {
        group = null;
        out.push({ type: 'system', message: m });
        continue;
      }
      const prev = group?.items[group.items.length - 1];
      const close =
        prev &&
        new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() <
          GROUP_WINDOW_MS;
      if (group && group.senderId === m.senderId && close) {
        group.items.push(m);
      } else {
        group = {
          senderId: m.senderId,
          senderName: m.senderName,
          senderImage: m.senderImage,
          mine: m.senderId === currentUserId,
          items: [m],
        };
        out.push({ type: 'group', group });
      }
    }
    return out;
  }, [messages, currentUserId]);

  function jumpToMessage(id: string) {
    const el = document.getElementById(`msg-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightId(id);
    window.setTimeout(
      () => setHighlightId((cur) => (cur === id ? null : cur)),
      1600,
    );
  }

  function startReply(m: ChatMessage) {
    setReplyingTo(m);
    setEditingId(null);
    textareaRef.current?.focus();
  }

  function startEdit(m: ChatMessage) {
    setEditingId(m.id);
    setEditText(m.content ?? '');
    setReplyingTo(null);
  }

  async function saveEdit(m: ChatMessage) {
    const next = editText.trim();
    if (!next && !m.imageUrl) {
      toast.error(t('chat.room.messageEmpty'));
      return;
    }
    if (next === (m.content ?? '')) {
      setEditingId(null);
      return;
    }
    setEditingId(null);
    patchLocal(m.id, {
      content: next || null,
      editedAt: new Date().toISOString(),
    });
    try {
      await editMessage({ chatId, messageId: m.id, content: next });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t('chat.room.couldNotEdit'),
      );
    }
  }

  async function removeMessage(m: ChatMessage) {
    patchLocal(m.id, {
      content: null,
      imageUrl: null,
      deletedAt: new Date().toISOString(),
    });
    if (replyingTo?.id === m.id) setReplyingTo(null);
    try {
      await deleteMessage({ chatId, messageId: m.id });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t('chat.room.couldNotDelete'),
      );
    }
  }

  // Moderator removal of someone else's message. Unlike removeMessage this is
  // NOT optimistic: the server may refuse (a moderator can't remove an admin's
  // message), so the bubble only tombstones once the action succeeds. The
  // broadcast tombstone also reaches this client, but patching here makes it
  // instant.
  async function moderatorRemove(m: ChatMessage) {
    try {
      await moderatorDeleteMessage(m.id);
      patchLocal(m.id, {
        content: null,
        imageUrl: null,
        deletedAt: new Date().toISOString(),
      });
      if (replyingTo?.id === m.id) setReplyingTo(null);
      toast.success(t('chat.room.messageRemovedToast'));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t('chat.room.couldNotRemove'),
      );
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error(t('chat.room.onlyImages'));
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error(t('chat.room.imageTooLarge'));
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      if (!res.ok) throw new Error('Upload failed');
      const { url } = await res.json();
      setPendingImage(url);
    } catch {
      toast.error(t('chat.room.couldNotUpload'));
    } finally {
      setUploading(false);
    }
  }

  async function submit(
    e: React.SubmitEvent | React.KeyboardEvent<HTMLTextAreaElement>,
  ) {
    e.preventDefault();
    const content = text.trim();
    if ((!content && !pendingImage) || sending || ended) return;

    const clientId = newId('msg');
    const replyToId = replyingTo?.id ?? null;
    const optimistic: ChatMessage = {
      id: clientId,
      chatId,
      senderId: currentUserId,
      senderName: currentUserName,
      senderImage: currentUserImage ?? null,
      kind: 'USER',
      meta: null,
      content: content || null,
      imageUrl: pendingImage,
      replyToId,
      replyTo: replyingTo
        ? {
            id: replyingTo.id,
            senderId: replyingTo.senderId,
            senderName: replyingTo.senderName,
            content: replyingTo.content,
            imageUrl: replyingTo.imageUrl,
            deletedAt: replyingTo.deletedAt,
          }
        : null,
      editedAt: null,
      deletedAt: null,
      createdAt: new Date().toISOString(),
    };
    appendLocal(optimistic);
    setText('');
    const imageUrl = pendingImage;
    setPendingImage(null);
    setReplyingTo(null);
    setSending(true);
    try {
      await sendMessage({
        chatId,
        content,
        imageUrl: imageUrl ?? undefined,
        clientId,
        replyToId: replyToId ?? undefined,
      });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Message failed to send',
      );
    } finally {
      setSending(false);
    }
  }

  const isEmpty = messages.length === 0;

  return (
    <div className='flex h-full flex-col'>
      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className='flex-1 overflow-y-auto px-4 py-6 sm:px-6'
      >
        {isEmpty ? (
          <div className='flex h-full items-center justify-center'>
            {emptyState ?? (
              <p className='text-muted-foreground text-sm'>
                No messages yet. Say hello!
              </p>
            )}
          </div>
        ) : (
          <ul className='flex flex-col gap-5'>
            {olderLoading && (
              <li className='flex justify-center py-1'>
                <Loader2Icon
                  className='text-muted-foreground size-4 animate-spin'
                  aria-hidden
                />
              </li>
            )}
            {rows.map((row) => {
              if (row.type === 'system') {
                return (
                  <SystemNotice key={row.message.id} message={row.message} />
                );
              }
              const g = row.group;
              const last = g.items[g.items.length - 1];
              return (
                <li
                  key={g.items[0].id}
                  className={cn(
                    'flex flex-col gap-1',
                    g.mine ? 'items-end' : 'items-start',
                  )}
                >
                  {g.items.map((m, idx) => {
                    const replyTarget = m.replyTo;
                    const editing = editingId === m.id;
                    // Any bubble stacked below an earlier one in the same group
                    // flattens its top corner on the tail side (right for mine,
                    // left for others), so the run reads as one connected column.
                    const groupedTop = idx > 0;
                    return (
                      <div
                        key={m.id}
                        id={`msg-${m.id}`}
                        className={cn(
                          'flex max-w-[85%] flex-col gap-1 rounded-2xl transition-shadow sm:max-w-[75%]',
                          g.mine ? 'items-end' : 'items-start',
                          highlightId === m.id &&
                            'ring-primary/60 ring-offset-background ring-2 ring-offset-4',
                        )}
                      >
                        {/* Quoted reply: its own dimmed bubble sitting above the
                            message, with a little connector arrow to the side. */}
                        {replyTarget && !m.deletedAt && !editing && (
                          <button
                            type='button'
                            onClick={() => jumpToMessage(replyTarget.id)}
                            className={cn(
                              'flex max-w-full items-end gap-1',
                              g.mine ? 'flex-row-reverse pr-3' : 'pl-3',
                            )}
                          >
                            <CornerUpRight
                              className={cn(
                                'text-muted-foreground mb-1 size-3.5 shrink-0',
                                g.mine && '-scale-x-100',
                              )}
                              aria-hidden
                            />
                            <span className='bg-secondary text-muted-foreground flex max-w-full min-w-0 items-baseline gap-1.5 rounded-xl px-2.5 py-1 text-xs'>
                              <span className='text-foreground/80 shrink-0 font-medium'>
                                {replyTarget.senderId === currentUserId
                                  ? t('chat.room.you')
                                  : replyTarget.senderName}
                              </span>
                              <span className='truncate opacity-80'>
                                {previewOf(t, replyTarget)}
                              </span>
                            </span>
                          </button>
                        )}

                        {/* Bubble + hover actions */}
                        <div
                          className={cn(
                            'group/msg flex max-w-full items-center gap-1',
                            g.mine && 'flex-row-reverse',
                          )}
                        >
                          {m.deletedAt ? (
                            <div className='text-muted-foreground border-border flex items-center gap-1.5 rounded-2xl border border-dashed px-3.5 py-2 text-sm italic'>
                              <Ban className='size-3.5' aria-hidden />
                              {t('chat.room.deleted')}
                            </div>
                          ) : editing ? (
                            <div className='bg-muted flex min-w-56 flex-col gap-2 rounded-2xl p-2'>
                              <Textarea
                                value={editText}
                                autoFocus
                                onChange={(e) => setEditText(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Escape') setEditingId(null);
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    saveEdit(m);
                                  }
                                }}
                                className='max-h-40 min-h-0! resize-none bg-transparent'
                                rows={2}
                              />
                              <div className='flex justify-end gap-1'>
                                <Button
                                  type='button'
                                  size='xs'
                                  variant='ghost'
                                  onClick={() => setEditingId(null)}
                                >
                                  {t('chat.room.cancel')}
                                </Button>
                                <Button
                                  type='button'
                                  size='xs'
                                  onClick={() => saveEdit(m)}
                                >
                                  <Check aria-hidden />
                                  {t('chat.room.save')}
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div
                              className={cn(
                                'flex max-w-full min-w-0 flex-col overflow-hidden rounded-2xl text-sm leading-relaxed',
                                g.mine
                                  ? 'bg-primary text-primary-foreground rounded-br-md'
                                  : 'bg-muted text-foreground rounded-bl-md',
                                groupedTop &&
                                  (g.mine ? 'rounded-tr-md' : 'rounded-tl-md'),
                              )}
                            >
                              {m.imageUrl && (
                                <button
                                  type='button'
                                  onClick={() => setLightboxSrc(m.imageUrl)}
                                  className='block cursor-zoom-in p-1'
                                  aria-label={t('chat.room.openImage')}
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={m.imageUrl}
                                    alt={t('chat.room.sharedImage')}
                                    onLoad={handleImageLoad}
                                    className='block max-h-80 w-full rounded-xl object-cover'
                                  />
                                </button>
                              )}

                              {m.content && (
                                <p
                                  className={cn(
                                    'wrap-break-word whitespace-pre-wrap',
                                    m.imageUrl
                                      ? 'px-3 pt-1 pb-2'
                                      : 'px-3.5 py-2',
                                  )}
                                >
                                  {m.content}
                                  {m.editedAt && (
                                    <span className='ml-1 align-baseline text-[10px] opacity-60'>
                                      {t('chat.room.edited')}
                                    </span>
                                  )}
                                </p>
                              )}
                            </div>
                          )}

                          {/* Per-message actions */}
                          {!m.deletedAt && !editing && (
                            <div className='opacity-0 transition-opacity group-hover/msg:opacity-100 has-data-[state=open]:opacity-100'>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    type='button'
                                    className='text-muted-foreground hover:bg-muted hover:text-foreground grid size-7 place-items-center rounded-full outline-none'
                                    aria-label={t('chat.room.messageActions')}
                                  >
                                    <MoreHorizontal className='size-4' />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                  align={g.mine ? 'end' : 'start'}
                                >
                                  <DropdownMenuItem
                                    onSelect={() => startReply(m)}
                                  >
                                    <Reply aria-hidden />
                                    {t('chat.room.reply')}
                                  </DropdownMenuItem>
                                  {g.mine && (
                                    <DropdownMenuItem
                                      onSelect={() => startEdit(m)}
                                    >
                                      <Pencil aria-hidden />
                                      {t('chat.room.edit')}
                                    </DropdownMenuItem>
                                  )}
                                  {g.mine && (
                                    <DropdownMenuItem
                                      variant='destructive'
                                      onSelect={() => removeMessage(m)}
                                    >
                                      <Trash2 aria-hidden />
                                      {t('chat.room.delete')}
                                    </DropdownMenuItem>
                                  )}
                                  {!g.mine && (
                                    <DropdownMenuItem
                                      onSelect={() =>
                                        setReportTarget({
                                          reportedUserId: m.senderId,
                                          name: m.senderName,
                                          chatId,
                                          messageId: m.id,
                                        })
                                      }
                                    >
                                      <Flag aria-hidden />
                                      {t('chat.room.report')}
                                    </DropdownMenuItem>
                                  )}
                                  {!g.mine && canModerate && (
                                    <DropdownMenuItem
                                      variant='destructive'
                                      onSelect={() => moderatorRemove(m)}
                                    >
                                      <ShieldX aria-hidden />
                                      {t('chat.room.removeMessage')}
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Group footer: avatar (others) + name + dynamic timestamp */}
                  <div
                    className={cn(
                      'text-muted-foreground flex items-center gap-1.5 px-1 text-xs',
                      g.mine && 'flex-row-reverse',
                    )}
                  >
                    {!g.mine &&
                      (onUserClickAction ? (
                        <button
                          type='button'
                          onClick={() => onUserClickAction(g.senderId)}
                          className='ring-ring shrink-0 rounded-full outline-none focus-visible:ring-2'
                          aria-label={t('chat.room.viewProfileAria', {
                            name: g.senderName,
                          })}
                        >
                          <UserAvatar
                            name={g.senderName}
                            image={g.senderImage}
                            className='size-5'
                          />
                        </button>
                      ) : (
                        <UserAvatar
                          name={g.senderName}
                          image={g.senderImage}
                          className='size-5'
                        />
                      ))}
                    {showSenderNames && !g.mine && (
                      <>
                        {onUserClickAction ? (
                          <button
                            type='button'
                            onClick={() => onUserClickAction(g.senderId)}
                            className='font-medium hover:underline'
                          >
                            {g.senderName}
                          </button>
                        ) : (
                          <span className='font-medium'>{g.senderName}</span>
                        )}
                        <span aria-hidden>·</span>
                      </>
                    )}
                    <time
                      dateTime={last.createdAt}
                      title={formatExactTimestamp(last.createdAt)}
                      suppressHydrationWarning
                    >
                      {formatMessageTime(last.createdAt)}
                    </time>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Composer */}
      <div className='border-border bg-background xs:p-4 border-t p-2'>
        <div className='flex w-full flex-col gap-2'>
          {replyingTo && (
            <div className='bg-muted flex items-center gap-2 rounded-lg px-3 py-2 text-sm'>
              <Reply
                className='text-muted-foreground size-4 shrink-0'
                aria-hidden
              />
              <div className='min-w-0 flex-1'>
                <p className='text-xs font-medium'>
                  {t('chat.room.replyingTo', {
                    name:
                      replyingTo.senderId === currentUserId
                        ? t('chat.room.yourself')
                        : replyingTo.senderName,
                  })}
                </p>
                <p className='text-muted-foreground line-clamp-1 text-xs'>
                  {previewOf(t, replyingTo)}
                </p>
              </div>
              <Button
                type='button'
                onClick={() => setReplyingTo(null)}
                size='icon-xs'
                variant='ghost'
                aria-label={t('chat.room.cancelReply')}
              >
                <XIcon aria-hidden />
              </Button>
            </div>
          )}
          {pendingImage && (
            <div className='relative self-start'>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={pendingImage}
                alt={t('chat.room.pendingPreview')}
                className='border-border max-h-28 rounded-lg border object-cover'
              />
              <Button
                type='button'
                onClick={() => setPendingImage(null)}
                className='absolute -top-1 -right-1'
                size='icon-xs'
                aria-label={t('chat.room.removeImage')}
              >
                <XIcon aria-hidden />
              </Button>
            </div>
          )}
          {ended ? (
            <p className='text-muted-foreground py-2 text-center text-sm'>
              {t('chat.room.conversationEnded')}
            </p>
          ) : (
            <form onSubmit={submit} className='flex items-center gap-2'>
              {allowImages && (
                <>
                  <input
                    ref={fileRef}
                    type='file'
                    accept='image/*'
                    className='hidden'
                    onChange={handleFile}
                  />
                  <Button
                    type='button'
                    variant='outline'
                    size='icon-lg'
                    disabled={uploading}
                    onClick={() => fileRef.current?.click()}
                    aria-label={t('chat.room.attachImage')}
                  >
                    {uploading ? (
                      <Loader2Icon className='animate-spin' aria-hidden />
                    ) : (
                      <ImagePlusIcon aria-hidden />
                    )}
                  </Button>
                </>
              )}
              <Textarea
                id='message'
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    if (
                      (e.nativeEvent as any).isComposing ||
                      (e as any).keyCode === 229
                    )
                      return;
                    e.preventDefault();
                    submit(e);
                  }
                }}
                className='max-h-18 min-h-0! resize-none'
                rows={1}
                placeholder={t('chat.room.typePlaceholder')}
              />
              <Button
                type='submit'
                size='icon-lg'
                disabled={sending || (!text.trim() && !pendingImage)}
                aria-label={t('chat.room.sendMessage')}
              >
                <SendHorizonal aria-hidden />
              </Button>
            </form>
          )}
        </div>
      </div>

      <ImageLightbox
        open={!!lightboxSrc}
        src={lightboxSrc ?? ''}
        alt={t('chat.room.sharedImage')}
        onCloseAction={() => setLightboxSrc(null)}
      />

      <ReportDialog
        target={reportTarget}
        open={reportTarget !== null}
        onOpenChange={(o) => {
          if (!o) setReportTarget(null);
        }}
      />
    </div>
  );
}
