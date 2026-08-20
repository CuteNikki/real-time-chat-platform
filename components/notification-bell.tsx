'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import useSWR from 'swr';

import {
  Bell,
  Check,
  Heart,
  Loader2,
  MessageCircle,
  Trash2,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react';

import { respondToRequest } from '@/app/actions/invites';
import {
  clearNotifications,
  deleteNotification,
  getNotifications,
  markNotificationsRead,
} from '@/app/actions/notifications';

import { playNotificationSound } from '@/lib/notification-sound';
import { EVENTS, userChannel } from '@/lib/pusher/channels';
import { getPusherClient } from '@/lib/pusher/client';
import type {
  NotificationCategory,
  NotificationSummary,
  NotificationType,
} from '@/lib/types';
import { cn } from '@/lib/utils';

import { useNotificationPrefs } from '@/components/notification-prefs-provider';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserAvatar } from '@/components/user/user-avatar';
import { UserPreviewDialog } from '@/components/user/user-preview';

type Counts = {
  requests: number;
  messages: number;
  likes: number;
  total: number;
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString();
}

function iconFor(type: NotificationSummary['type']) {
  if (type === 'FRIEND_REQUEST') return UserPlus;
  if (type === 'FRIEND_ACCEPT') return UserCheck;
  if (type === 'LIKE') return Heart;
  return MessageCircle;
}

// Map a notification type to its preference category. MESSAGE is ambiguous
// (direct vs room), so the realtime payload carries an explicit category that
// takes precedence; this fallback assumes a direct message.
function categoryForType(type: NotificationType): NotificationCategory {
  switch (type) {
    case 'FRIEND_REQUEST':
      return 'friendRequest';
    case 'FRIEND_ACCEPT':
      return 'friendAccept';
    case 'LIKE':
      return 'like';
    default:
      return 'directMessage';
  }
}

const isMessage = (n: NotificationSummary) => n.type === 'MESSAGE';
const isLike = (n: NotificationSummary) => n.type === 'LIKE';

export function NotificationBell({
  userId,
  username,
}: {
  userId: string;
  // The current user's own username, used to deep-link LIKE notifications to
  // the liked post on their own profile.
  username: string | null;
}) {
  const router = useRouter();
  const { data, mutate } = useSWR<Counts>(
    '/api/notifications/unread-count',
    fetcher,
    {
      refreshInterval: 20000,
    },
  );
  const total = data?.total ?? 0;

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'requests' | 'messages' | 'likes'>('requests');
  const [items, setItems] = useState<NotificationSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [previewUserId, setPreviewUserId] = useState<string | null>(null);

  const { prefs } = useNotificationPrefs();

  const requests = items.filter((n) => !isMessage(n) && !isLike(n));
  const messages = items.filter(isMessage);
  const likes = items.filter(isLike);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await getNotifications());
    } catch {
      // Silent: the badge still works even if the list fails to load.
    } finally {
      setLoading(false);
    }
  }, []);

  // Load the list whenever the menu opens.
  useEffect(() => {
    if (open) load();
  }, [open, load]);

  // Subscribe for realtime notifications: refresh the badge, reload the open
  // list, and surface a lightweight toast (no forced navigation).
  useEffect(() => {
    const pusher = getPusherClient();
    const channel = pusher.subscribe(userChannel(userId));
    const onNotification = (payload: {
      body?: string | null;
      type?: NotificationType;
      category?: NotificationCategory | null;
    }) => {
      mutate();
      if (open) load();

      const category =
        payload?.category ?? categoryForType(payload?.type ?? 'MESSAGE');
      const catPref = prefs.categories[category];

      // Popup (toast) — respect the per-category popup preference.
      if (payload?.body && catPref.popup) toast(payload.body);

      // Sound — respect the master switch, per-category sound flag, and volume.
      if (prefs.soundEnabled && catPref.sound) {
        playNotificationSound(category, prefs.volume);
      }
    };
    channel.bind(EVENTS.NOTIFICATION, onNotification);
    return () => {
      channel.unbind(EVENTS.NOTIFICATION, onNotification);
    };
  }, [userId, mutate, open, load, prefs]);

  // Mark the active tab's notifications read shortly after viewing.
  useEffect(() => {
    if (!open) return;
    const list =
      tab === 'messages' ? messages : tab === 'likes' ? likes : requests;
    if (!list.some((n) => !n.read)) return;
    const t = setTimeout(async () => {
      await markNotificationsRead({ category: tab });
      setItems((prev) =>
        prev.map((n) => {
          const inTab =
            tab === 'messages'
              ? isMessage(n)
              : tab === 'likes'
                ? isLike(n)
                : !isMessage(n) && !isLike(n);
          return inTab ? { ...n, read: true } : n;
        }),
      );
      mutate();
    }, 800);
    return () => clearTimeout(t);
  }, [open, tab, requests, messages, likes, mutate]);

  async function respond(n: NotificationSummary, accept: boolean) {
    if (!n.inviteId || busyId) return;
    setBusyId(n.id);
    try {
      await respondToRequest(n.inviteId, accept);
      await deleteNotification(n.id);
      setItems((prev) => prev.filter((x) => x.id !== n.id));
      mutate();
      toast.success(
        accept
          ? `You're now friends with ${n.actorName ?? 'them'}`
          : 'Request declined',
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not respond');
    } finally {
      setBusyId(null);
    }
  }

  async function remove(n: NotificationSummary) {
    setItems((prev) => prev.filter((x) => x.id !== n.id));
    try {
      await deleteNotification(n.id);
      mutate();
    } catch {
      // If it fails, reload to resync.
      load();
    }
  }

  async function clearTab() {
    const category = tab;
    setItems((prev) =>
      prev.filter((n) => {
        if (category === 'messages') return !isMessage(n);
        if (category === 'likes') return !isLike(n);
        return isMessage(n) || isLike(n);
      }),
    );
    try {
      await clearNotifications({ category });
      mutate();
    } catch {
      load();
    }
  }

  function openMessage(n: NotificationSummary) {
    setOpen(false);
    if (n.chatId) router.push(`/app/messages?c=${n.chatId}`);
  }

  const unreadRequests = requests.filter((n) => !n.read).length;
  const unreadMessages = messages.filter((n) => !n.read).length;
  const unreadLikes = likes.filter((n) => !n.read).length;

  const activeList =
    tab === 'messages' ? messages : tab === 'likes' ? likes : requests;

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          aria-label={
            total > 0 ? `Notifications, ${total} unread` : 'Notifications'
          }
          className={cn(
            buttonVariants({
              variant: open ? 'secondary' : 'ghost',
              size: 'icon',
            }),
            'relative',
          )}
        >
          <Bell className='size-5' aria-hidden />
          {total > 0 && (
            <Badge
              className='absolute -top-1 -right-1 h-5 min-w-5 justify-center px-1 text-[10px] tabular-nums'
              variant='default'
            >
              {total > 99 ? '99+' : total}
            </Badge>
          )}
        </PopoverTrigger>

        <PopoverContent
          align='end'
          className='w-[calc(100vw-1.5rem)] p-0 sm:w-100'
        >
          <div className='border-border flex items-center justify-between gap-2 border-b px-3 py-2.5'>
            <h2 className='text-sm font-semibold'>Notifications</h2>
            {activeList.length > 0 && (
              <button
                type='button'
                onClick={clearTab}
                className='text-muted-foreground hover:text-foreground text-xs transition-colors'
              >
                Clear all
              </button>
            )}
          </div>

          <Tabs
            value={tab}
            onValueChange={(v) =>
              setTab(v as 'requests' | 'messages' | 'likes')
            }
          >
            <div className='px-3 pt-3'>
              <TabsList className='w-full'>
                <TabsTrigger value='requests' className='gap-2'>
                  Requests
                  {unreadRequests > 0 ? (
                    <Badge className='h-5 min-w-5 justify-center px-1 tabular-nums'>
                      {unreadRequests}
                    </Badge>
                  ) : null}
                </TabsTrigger>
                <TabsTrigger value='messages' className='gap-2'>
                  Messages
                  {unreadMessages > 0 ? (
                    <Badge className='h-5 min-w-5 justify-center px-1 tabular-nums'>
                      {unreadMessages}
                    </Badge>
                  ) : null}
                </TabsTrigger>
                <TabsTrigger value='likes' className='gap-2'>
                  Likes
                  {unreadLikes > 0 ? (
                    <Badge className='h-5 min-w-5 justify-center px-1 tabular-nums'>
                      {unreadLikes}
                    </Badge>
                  ) : null}
                </TabsTrigger>
              </TabsList>
            </div>

            <div className='max-h-[min(70vh,28rem)] overflow-y-auto p-3'>
              {loading && items.length === 0 ? (
                <div className='flex h-32 items-center justify-center'>
                  <Loader2
                    className='text-muted-foreground size-5 animate-spin'
                    aria-hidden
                  />
                </div>
              ) : (
                <>
                  <TabsContent value='requests'>
                    {requests.length === 0 ? (
                      <EmptyState label='No friend requests right now.' />
                    ) : (
                      <ul className='flex flex-col gap-1.5'>
                        {requests.map((n) => (
                          <RequestRow
                            key={n.id}
                            n={n}
                            busy={busyId === n.id}
                            onAccept={() => respond(n, true)}
                            onDecline={() => respond(n, false)}
                            onView={() =>
                              n.actorId && setPreviewUserId(n.actorId)
                            }
                            onDelete={() => remove(n)}
                          />
                        ))}
                      </ul>
                    )}
                  </TabsContent>

                  <TabsContent value='messages'>
                    {messages.length === 0 ? (
                      <EmptyState label='No new message notifications.' />
                    ) : (
                      <ul className='flex flex-col gap-1.5'>
                        {messages.map((n) => (
                          <MessageRow
                            key={n.id}
                            n={n}
                            onOpen={() => openMessage(n)}
                            onDelete={() => remove(n)}
                          />
                        ))}
                      </ul>
                    )}
                  </TabsContent>

                  <TabsContent value='likes'>
                    {likes.length === 0 ? (
                      <EmptyState label='No likes on your posts yet.' />
                    ) : (
                      <ul className='flex flex-col gap-1.5'>
                        {likes.map((n) => (
                          <LikeRow
                            key={n.id}
                            n={n}
                            username={username}
                            onView={() =>
                              n.actorId && setPreviewUserId(n.actorId)
                            }
                            onDelete={() => remove(n)}
                            onNavigate={() => setOpen(false)}
                          />
                        ))}
                      </ul>
                    )}
                  </TabsContent>
                </>
              )}
            </div>
          </Tabs>
        </PopoverContent>
      </Popover>

      <UserPreviewDialog
        userId={previewUserId}
        onCloseAction={() => {
          setPreviewUserId(null);
          // The preview can accept/cancel a request; resync when it closes.
          if (open) load();
          mutate();
        }}
      />
    </>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className='border-border flex flex-col items-center gap-2 rounded-lg border border-dashed py-10 text-center'>
      <Bell className='text-muted-foreground size-5' aria-hidden />
      <p className='text-muted-foreground text-sm'>{label}</p>
    </div>
  );
}

function RowShell({
  n,
  children,
  onDelete,
}: {
  n: NotificationSummary;
  children: React.ReactNode;
  onDelete: () => void;
}) {
  const Icon = iconFor(n.type);
  return (
    <li
      className={cn(
        'border-border bg-card flex items-center justify-between gap-4 rounded-xl border p-4',
        !n.read && 'bg-card',
      )}
    >
      <div className='relative shrink-0 self-start'>
        <UserAvatar
          name={n.actorName ?? 'User'}
          image={n.actorImage}
          className='size-9'
        />
        <span className='bg-primary text-primary-foreground ring-popover absolute -right-1 -bottom-1 grid size-4 place-items-center rounded-full ring-2'>
          <Icon className='size-2.5' aria-hidden />
        </span>
      </div>
      <div className='min-w-0 flex-1'>{children}</div>
      <button
        type='button'
        onClick={onDelete}
        aria-label='Delete notification'
        className='text-muted-foreground hover:bg-secondary hover:text-foreground absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-md opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100'
      >
        <Trash2 className='size-3.5' aria-hidden />
      </button>
    </li>
  );
}

function RequestRow({
  n,
  busy,
  onAccept,
  onDecline,
  onView,
  onDelete,
}: {
  n: NotificationSummary;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onView: () => void;
  onDelete: () => void;
}) {
  return (
    <RowShell n={n} onDelete={onDelete}>
      <div className='flex items-start justify-between gap-2 pr-5'>
        <p className='text-sm leading-tight'>
          <span
            className='cursor-pointer font-medium hover:underline'
            onClick={onView}
          >
            {n.actorName ?? 'Someone'}
          </span>
          {n.body ? (
            <span className='text-muted-foreground'>
              {' '}
              {stripName(n.body, n.actorName)}
            </span>
          ) : null}
        </p>
        <span
          className='text-muted-foreground shrink-0 text-xs'
          suppressHydrationWarning
        >
          {timeAgo(n.createdAt)}
        </span>
      </div>
      {n.inviteId ? (
        <div className='mt-2 flex items-center gap-1.5'>
          <Button
            size='sm'
            className='h-7 gap-1 px-2 text-xs'
            disabled={busy}
            onClick={onAccept}
          >
            {busy ? (
              <Loader2 className='size-3.5 animate-spin' aria-hidden />
            ) : (
              <Check className='size-3.5' aria-hidden />
            )}
            Accept
          </Button>
          <Button
            size='sm'
            variant='secondary'
            className='h-7 gap-1 px-2 text-xs'
            disabled={busy}
            onClick={onDecline}
          >
            <X className='size-3.5' aria-hidden />
            Decline
          </Button>
        </div>
      ) : null}
    </RowShell>
  );
}

function LikeRow({
  n,
  username,
  onView,
  onDelete,
  onNavigate,
}: {
  n: NotificationSummary;
  // The current user's own username, so we can deep-link to the liked post
  // on their profile. Null if it hasn't loaded yet — falls back to plain text.
  username: string | null;
  onView: () => void;
  onDelete: () => void;
  onNavigate: () => void;
}) {
  const postHref =
    n.postId && username ? `/app/u/${username}?post=${n.postId}` : null;

  return (
    <RowShell n={n} onDelete={onDelete}>
      <div className='flex items-start justify-between gap-2 pr-5'>
        <p className='text-sm leading-tight'>
          <span
            className='cursor-pointer font-medium hover:underline'
            onClick={onView}
          >
            {n.actorName ?? 'Someone'}
          </span>
          <span className='text-muted-foreground'> liked your </span>
          {postHref ? (
            <Link
              href={postHref}
              onClick={onNavigate}
              className='text-foreground cursor-pointer hover:underline'
            >
              post
            </Link>
          ) : (
            <span className='text-muted-foreground'>post</span>
          )}
        </p>
        <span
          className='text-muted-foreground shrink-0 text-xs'
          suppressHydrationWarning
        >
          {timeAgo(n.createdAt)}
        </span>
      </div>
    </RowShell>
  );
}

function MessageRow({
  n,
  onOpen,
  onDelete,
}: {
  n: NotificationSummary;
  onOpen: () => void;
  onDelete: () => void;
}) {
  return (
    <RowShell n={n} onDelete={onDelete}>
      <button
        type='button'
        onClick={onOpen}
        className='block w-full pr-5 text-left'
      >
        <div className='flex items-start justify-between gap-2'>
          <p className='truncate text-sm leading-tight font-medium'>
            {n.actorName ?? 'New message'}
          </p>
          <span
            className='text-muted-foreground shrink-0 text-xs'
            suppressHydrationWarning
          >
            {timeAgo(n.createdAt)}
          </span>
        </div>
        {n.body ? (
          <p className='text-muted-foreground mt-0.5 line-clamp-2 text-sm'>
            {n.body}
          </p>
        ) : null}
      </button>
    </RowShell>
  );
}

// Notification bodies read like "Alex sent you a friend request". When we
// already show the name in bold, drop a leading duplicate name for cleaner copy.
function stripName(body: string, name: string | null) {
  if (name && body.startsWith(name)) return body.slice(name.length).trimStart();
  return body;
}
