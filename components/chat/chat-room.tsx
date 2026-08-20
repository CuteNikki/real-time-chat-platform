'use client';

import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { ImagePlusIcon, Loader2Icon, SendHorizonal, XIcon } from 'lucide-react';

import { sendMessage } from '@/app/actions/chat';

import { useChat } from '@/hooks/use-chat';

import { newId } from '@/lib/id';
import type { ChatMessage, NotificationCategory } from '@/lib/types';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { UserAvatar } from '@/components/user/user-avatar';

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
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
}) {
  const { messages, ended, appendLocal } = useChat({
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
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Only image files are allowed');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error('Image must be under 8MB');
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
      toast.error('Could not upload image');
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
    const optimistic: ChatMessage = {
      id: clientId,
      chatId,
      senderId: currentUserId,
      senderName: currentUserName,
      senderImage: currentUserImage ?? null,
      content: content || null,
      imageUrl: pendingImage,
      createdAt: new Date().toISOString(),
    };
    appendLocal(optimistic);
    setText('');
    const imageUrl = pendingImage;
    setPendingImage(null);
    setSending(true);
    try {
      await sendMessage({
        chatId,
        content,
        imageUrl: imageUrl ?? undefined,
        clientId,
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
      <div ref={scrollRef} className='flex-1 overflow-y-auto px-4 py-6 sm:px-6'>
        {isEmpty ? (
          <div className='flex h-full items-center justify-center'>
            {emptyState ?? (
              <p className='text-muted-foreground text-sm'>
                No messages yet. Say hello!
              </p>
            )}
          </div>
        ) : (
          <ul className='flex flex-col gap-4'>
            {messages.map((m) => {
              const mine = m.senderId === currentUserId;
              return (
                <li
                  key={m.id}
                  className={cn('flex gap-3', mine && 'flex-row-reverse')}
                >
                  {!mine &&
                    (onUserClickAction ? (
                      <button
                        type='button'
                        onClick={() => onUserClickAction(m.senderId)}
                        className='ring-ring mt-1 shrink-0 rounded-full transition-opacity outline-none hover:opacity-80 focus-visible:ring-2'
                        aria-label={`View ${m.senderName}'s profile`}
                      >
                        <UserAvatar
                          name={m.senderName}
                          image={m.senderImage}
                          className='mt-1 size-8 shrink-0'
                        />
                      </button>
                    ) : (
                      <UserAvatar
                        name={m.senderName}
                        image={m.senderImage}
                        className='mt-1 size-8 shrink-0'
                      />
                    ))}
                  <div
                    className={cn(
                      'flex max-w-[75%] flex-col gap-1',
                      mine && 'items-end',
                    )}
                  >
                    {showSenderNames &&
                      !mine &&
                      (onUserClickAction ? (
                        <button
                          type='button'
                          onClick={() => onUserClickAction(m.senderId)}
                          className='text-muted-foreground self-start px-1 text-left text-xs font-medium hover:underline'
                        >
                          {m.senderName}
                        </button>
                      ) : (
                        <span className='text-muted-foreground px-1 text-xs font-medium'>
                          {m.senderName}
                        </span>
                      ))}
                    <div
                      className={cn(
                        'rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                        mine
                          ? 'bg-primary text-primary-foreground rounded-br-sm'
                          : 'bg-secondary text-secondary-foreground rounded-bl-sm',
                      )}
                    >
                      {m.imageUrl && (
                        <img
                          src={m.imageUrl || '/placeholder.svg'}
                          alt='Shared image'
                          className='mb-1 max-h-72 rounded-lg object-cover'
                        />
                      )}
                      {m.content && (
                        <p className='wrap-break-word whitespace-pre-wrap'>
                          {m.content}
                        </p>
                      )}
                    </div>
                    <span
                      className='text-muted-foreground px-1 text-[11px]'
                      suppressHydrationWarning
                    >
                      {timeLabel(m.createdAt)}
                    </span>
                  </div>
                </li>
              );
            })}
            <div ref={bottomRef} />
          </ul>
        )}
      </div>

      {/* Composer */}
      <div className='border-border bg-background xs:p-4 border-t p-2'>
        <div className='flex w-full flex-col gap-2'>
          {pendingImage && (
            <div className='relative self-start'>
              <img
                src={pendingImage || '/placeholder.svg'}
                alt='Pending upload preview'
                className='border-border max-h-28 rounded-lg border object-cover'
              />
              <Button
                type='button'
                onClick={() => setPendingImage(null)}
                className='absolute -top-1 -right-1'
                size='icon-xs'
                aria-label='Remove image'
              >
                <XIcon aria-hidden />
              </Button>
            </div>
          )}
          {ended ? (
            <p className='text-muted-foreground py-2 text-center text-sm'>
              This conversation has ended.
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
                    aria-label='Attach image'
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
                placeholder='Type a message…'
              />
              <Button
                type='submit'
                size='icon-lg'
                disabled={sending || (!text.trim() && !pendingImage)}
                aria-label='Send message'
              >
                <SendHorizonal aria-hidden />
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
