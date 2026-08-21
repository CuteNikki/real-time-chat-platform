'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import {
  ArrowLeft,
  Eraser,
  Flag,
  MessageCircleIcon,
  MoreVertical,
  Phone,
  Search,
  UserMinus,
  Video,
} from 'lucide-react';

import { clearChat, getMessages } from '@/app/actions/chat';
import type { PrivateConversation } from '@/app/actions/invites';
import { removeFriend } from '@/app/actions/invites';

import type { ChatMessage } from '@/lib/types';
import { cn } from '@/lib/utils';

import { useCall } from '@/components/call/call-provider';
import { ChatRoom } from '@/components/chat/chat-room';
import { ReportDialog } from '@/components/report-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { UserAvatar } from '@/components/user/user-avatar';
import { UserPreviewDialog } from '@/components/user/user-preview';

export function MessagesWorkspace({
  currentUserId,
  currentUserName,
  currentUserImage,
  conversations,
  initialChatId,
}: {
  currentUserId: string;
  currentUserName: string;
  currentUserImage: string | null;
  conversations: PrivateConversation[];
  initialChatId: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { startCall } = useCall();
  const { t } = useTranslation();

  // Conversations kept in local state so we can drop one instantly on unfriend.
  const [convos, setConvos] = useState(conversations);
  useEffect(() => {
    setConvos(conversations);
  }, [conversations]);

  // Only open a conversation when one is explicitly requested (deep link via
  // ?c=). Otherwise the user must pick a conversation themselves.
  const [activeId, setActiveId] = useState<string | null>(
    initialChatId && conversations.some((c) => c.chatId === initialChatId)
      ? initialChatId
      : null,
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [previewUserId, setPreviewUserId] = useState<string | null>(null);
  const [menuBusy, setMenuBusy] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  // Keep the URL in sync so refresh/deep-link works.
  useEffect(() => {
    const current = searchParams.get('c');
    if (activeId && activeId !== current) {
      router.replace(`/app/messages?c=${activeId}`, { scroll: false });
    }
  }, [activeId, router, searchParams]);

  // Load messages when the active conversation changes.
  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getMessages(activeId)
      .then((m) => {
        if (!cancelled) setMessages(m);
      })
      .catch(() => {
        if (!cancelled) setMessages([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  const active = convos.find((c) => c.chatId === activeId) ?? null;

  const filtered = convos.filter((c) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      c.partnerName.toLowerCase().includes(q) ||
      (c.partnerUsername ?? '').toLowerCase().includes(q)
    );
  });

  async function handleClearChat() {
    if (!active) return;
    setMenuBusy(true);
    try {
      await clearChat(active.chatId);
      setMessages([]);
      // Reflect the emptied preview in the conversation list.
      setConvos((cs) =>
        cs.map((c) =>
          c.chatId === active.chatId
            ? { ...c, lastMessage: null, lastAt: null, lastFromMe: false }
            : c,
        ),
      );
      toast.success(t('messages.chatCleared'));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t('messages.couldNotClear'),
      );
    } finally {
      setMenuBusy(false);
    }
  }

  async function handleUnfriend() {
    if (!active || !active.partnerId) return;
    setMenuBusy(true);
    try {
      await removeFriend(active.partnerId);
      const removedName = active.partnerName;
      setConvos((cs) => cs.filter((c) => c.chatId !== active.chatId));
      setActiveId(null);
      router.replace('/app/messages', { scroll: false });
      toast.success(t('messages.removedFriend', { name: removedName }));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t('messages.couldNotRemoveFriend'),
      );
    } finally {
      setMenuBusy(false);
    }
  }

  return (
    <div className='flex h-full w-full'>
      {/* Conversation list */}
      <aside
        className={cn(
          'border-border flex w-full shrink-0 flex-col border-r sm:w-80',
          active && 'hidden sm:flex',
        )}
      >
        <div className='border-border flex h-16 shrink-0 items-center border-b px-3'>
          <div className='relative w-full'>
            <Search
              className='text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2'
              aria-hidden
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('messages.searchPlaceholder')}
              className='pl-9'
            />
          </div>
        </div>

        <div className='flex-1 overflow-y-auto'>
          {filtered.length === 0 ? (
            <div className='p-6 text-center'>
              <p className='text-muted-foreground text-sm text-balance'>
                {t('messages.noConversations')}
              </p>
              <Link
                href='/app/friends'
                className='text-primary mt-2 inline-block text-sm font-medium hover:underline'
              >
                {t('messages.findFriends')}
              </Link>
            </div>
          ) : (
            <ul>
              {filtered.map((c) => {
                const isActive = c.chatId === activeId;
                return (
                  <li key={c.chatId}>
                    <button
                      type='button'
                      onClick={() => setActiveId(c.chatId)}
                      className={cn(
                        'flex w-full items-center gap-3 px-3 py-3 text-left transition-colors',
                        isActive ? 'bg-secondary' : 'hover:bg-muted',
                      )}
                    >
                      <UserAvatar
                        name={c.partnerName}
                        image={c.partnerImage}
                        className='size-11 shrink-0'
                      />
                      <div className='min-w-0 flex-1'>
                        <p className='truncate leading-tight font-medium'>
                          {c.partnerName}
                        </p>
                        <p className='text-muted-foreground truncate text-xs'>
                          {c.lastMessage
                            ? `${c.lastFromMe ? t('messages.youPrefix') : ''}${c.lastMessage}`
                            : t('messages.noMessages')}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      {/* Active conversation */}
      <section
        className={cn(
          'flex min-w-0 flex-1 flex-col',
          !active && 'hidden sm:flex',
        )}
      >
        {active ? (
          <>
            <header className='border-border flex h-16 shrink-0 items-center gap-3 border-b px-4'>
              <button
                type='button'
                onClick={() => setActiveId(null)}
                className='text-muted-foreground hover:text-foreground -ml-1 shrink-0 rounded-md p-1 sm:hidden'
                aria-label={t('messages.back')}
              >
                <ArrowLeft className='size-5' aria-hidden />
              </button>
              <button
                type='button'
                onClick={() =>
                  active.partnerId && setPreviewUserId(active.partnerId)
                }
                className='flex items-center gap-3 text-left hover:opacity-80'
              >
                <UserAvatar
                  name={active.partnerName}
                  image={active.partnerImage}
                  className='size-9'
                />
                <div className='leading-tight'>
                  <p className='font-semibold'>{active.partnerName}</p>
                  {active.partnerUsername ? (
                    <p className='text-muted-foreground text-xs'>
                      @{active.partnerUsername}
                    </p>
                  ) : null}
                </div>
              </button>

              <div className='ml-auto flex shrink-0 items-center gap-0.5'>
                <Button
                  size='icon'
                  variant='ghost'
                  onClick={() =>
                    active.partnerId &&
                    startCall(
                      active.chatId,
                      {
                        id: active.partnerId,
                        name: active.partnerName,
                        image: active.partnerImage,
                      },
                      { video: false },
                    )
                  }
                  disabled={!active.partnerId}
                  aria-label={t('messages.startVoice')}
                >
                  <Phone className='shrink-0' aria-hidden />
                </Button>
                <Button
                  size='icon'
                  variant='ghost'
                  onClick={() =>
                    active.partnerId &&
                    startCall(
                      active.chatId,
                      {
                        id: active.partnerId,
                        name: active.partnerName,
                        image: active.partnerImage,
                      },
                      { video: true },
                    )
                  }
                  disabled={!active.partnerId}
                  aria-label={t('messages.startVideo')}
                >
                  <Video className='shrink-0' aria-hidden />
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size='icon'
                      variant='ghost'
                      className='shrink-0'
                      disabled={menuBusy}
                      aria-label={t('messages.options')}
                    >
                      <MoreVertical className='shrink-0' aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align='end'>
                    <DropdownMenuItem onClick={handleClearChat}>
                      <Eraser className='size-4' aria-hidden />
                      {t('messages.clearChat')}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setReportOpen(true)}
                      disabled={!active.partnerId}
                    >
                      <Flag className='size-4' aria-hidden />
                      {t('messages.reportUser')}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant='destructive'
                      onClick={handleUnfriend}
                    >
                      <UserMinus className='size-4' aria-hidden />
                      {t('messages.unfriend')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </header>

            <div className='min-h-0 flex-1'>
              {loading ? (
                <div className='flex h-full items-center justify-center'>
                  <p className='text-muted-foreground text-sm'>
                    {t('messages.loadingMessages')}
                  </p>
                </div>
              ) : (
                <ChatRoom
                  key={active.chatId}
                  chatId={active.chatId}
                  currentUserId={currentUserId}
                  currentUserName={currentUserName}
                  currentUserImage={currentUserImage}
                  initialMessages={messages}
                  allowImages
                  onUserClickAction={setPreviewUserId}
                  notifyCategory='directMessage'
                  emptyState={
                    <p className='text-muted-foreground text-sm text-balance'>
                      {t('messages.conversationStart', {
                        name: active.partnerName,
                      })}
                    </p>
                  }
                />
              )}
            </div>
          </>
        ) : (
          <EmptyState
            icon={MessageCircleIcon}
            title={t('messages.chooseTitle')}
            description={t('messages.chooseDesc')}
            className='h-full'
          />
        )}
      </section>

      <UserPreviewDialog
        userId={previewUserId}
        onCloseAction={() => setPreviewUserId(null)}
      />

      <ReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        target={
          active?.partnerId
            ? {
                reportedUserId: active.partnerId,
                name: active.partnerName,
                chatId: active.chatId,
              }
            : null
        }
      />
    </div>
  );
}
