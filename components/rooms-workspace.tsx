'use client';

import type React from 'react';

import { getMessages } from '@/app/actions/chat';
import { createRoom, deleteRoom, joinRoom } from '@/app/actions/rooms';
import { ChatRoom } from '@/components/chat-room';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserAvatar } from '@/components/user-avatar';
import { UserPreviewDialog } from '@/components/user-preview';
import { RoomMember, useRoomMembers } from '@/hooks/use-room-members';
import type { ChatMessage, RoomSummary } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  Hash,
  Loader2,
  MessagesSquareIcon,
  Plus,
  Trash2Icon,
  Users,
  Users2Icon,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// Shared online-members list, used both in the desktop sidebar and the mobile
// "who's online" dialog so the two never drift apart.
function MembersList({
  members,
  onSelect,
}: {
  members: RoomMember[];
  onSelect: (id: string) => void;
}) {
  return (
    <ul className='flex flex-col gap-0.5'>
      {members.map((m) => (
        <li key={m.id}>
          <button
            type='button'
            onClick={() => onSelect(m.id)}
            className='hover:bg-secondary flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors'
            aria-label={
              m.isMe ? 'View your profile' : `View ${m.name}'s profile`
            }
          >
            <div className='relative shrink-0'>
              <UserAvatar
                name={m.name}
                image={m.image ?? null}
                className='size-7'
              />
            </div>
            <span className='min-w-0 flex-1 truncate text-base'>
              {m.name}
              {m.isMe && (
                <span className='text-muted-foreground ml-1 text-xs'>
                  (YOU)
                </span>
              )}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function RoomsWorkspace({
  initialRooms,
  me,
  canCreate = false,
  canDelete = false,
}: {
  initialRooms: RoomSummary[];
  me: { id: string; name: string; image: string | null };
  canCreate?: boolean;
  canDelete?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlChatId = searchParams.get('c');

  const { data: rooms = initialRooms, mutate } = useSWR<RoomSummary[]>(
    '/api/rooms',
    fetcher,
    {
      fallbackData: initialRooms,
      refreshInterval: 5000,
    },
  );

  const [activeChatId, setActiveChatId] = useState<string | null>(urlChatId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);

  // The user whose profile preview popup is open (null = closed).
  const [previewUserId, setPreviewUserId] = useState<string | null>(null);

  // Dialog state for creating a channel.
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  // Confirmation dialog state for deleting the active channel.
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Mobile-only "who's online" dialog (the sidebar member list is hidden while
  // a channel is open on small screens).
  const [membersOpen, setMembersOpen] = useState(false);

  const members = useRoomMembers(activeChatId);
  const activeRoom = rooms.find((r) => r.id === activeChatId) ?? null;

  // Track the last channel we loaded so re-renders don't refetch endlessly.
  const loadedFor = useRef<string | null>(null);

  // Fire-and-forget leave that survives page unloads (uses sendBeacon).
  const beaconLeave = useCallback((chatId: string) => {
    if (!chatId) return;
    const payload = JSON.stringify({ chatId });
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon(
        '/api/rooms/leave',
        new Blob([payload], { type: 'application/json' }),
      );
    } else {
      void fetch('/api/rooms/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      });
    }
  }, []);

  const openChannel = useCallback(
    async (chatId: string) => {
      if (loadedFor.current === chatId) return;
      // Leave the previously active channel before switching.
      if (loadedFor.current && loadedFor.current !== chatId) {
        beaconLeave(loadedFor.current);
      }
      loadedFor.current = chatId;
      setActiveChatId(chatId);
      setLoading(true);
      router.replace(`/app/rooms?c=${chatId}`, { scroll: false });
      try {
        await joinRoom(chatId);
        const msgs = await getMessages(chatId);
        setMessages(msgs);
        mutate();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Could not open channel',
        );
        loadedFor.current = null;
        setActiveChatId(null);
      } finally {
        setLoading(false);
      }
    },
    [router, mutate, beaconLeave],
  );

  // Auto-leave the active channel when the user navigates away, closes the tab,
  // or this workspace unmounts — no explicit "Leave" button needed.
  useEffect(() => {
    function handlePageHide() {
      if (loadedFor.current) beaconLeave(loadedFor.current);
    }
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      if (loadedFor.current) beaconLeave(loadedFor.current);
    };
  }, [beaconLeave]);

  // Open the channel referenced in the URL on first load / back-forward nav.
  useEffect(() => {
    if (urlChatId && loadedFor.current !== urlChatId) {
      void openChannel(urlChatId);
    }
    if (!urlChatId) {
      loadedFor.current = null;
      setActiveChatId(null);
    }
  }, [urlChatId, openChannel]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName || creating) return;

    setCreating(true);

    toast.promise(
      (async () => {
        const { chatId } = await createRoom(trimmedName);
        setDialogOpen(false);
        setName('');
        await mutate();
        void openChannel(chatId);
      })(),
      {
        loading: `Creating #${trimmedName}...`,
        success: `Created #${trimmedName}`,
        error: (err) =>
          err instanceof Error ? err.message : 'Could not create room',
      },
    );

    setCreating(false);
  }

  async function handleDelete() {
    if (!activeChatId || deleting) return;
    const roomName = activeRoom?.name ?? 'channel';
    setDeleting(true);

    const targetChatId = activeChatId;

    setDeleteOpen(false);

    toast.promise(deleteRoom(targetChatId), {
      loading: `Deleting #${roomName}...`,
      success: () => {
        loadedFor.current = null;
        setActiveChatId(null);
        setMessages([]);
        router.replace('/app/rooms', { scroll: false });
        mutate();
        return `Deleted #${roomName}`;
      },
      error: (err) =>
        err instanceof Error ? err.message : 'Could not delete room',
    });

    setDeleting(false);
  }

  return (
    <div className='flex h-full overflow-hidden'>
      {/* Left rail: channels + members */}
      <aside
        className={cn(
          'border-border flex w-full flex-col border-r md:w-72 lg:w-80',
          activeChatId && 'hidden md:flex',
        )}
      >
        {/* Channels */}
        <div className='flex min-h-0 flex-1 flex-col'>
          <div className='flex items-center justify-between p-4 pb-2'>
            <h2 className='text-muted-foreground text-xs font-semibold tracking-wider uppercase'>
              Channels
            </h2>
            <span className='text-muted-foreground text-xs'>
              {rooms.length}
            </span>
          </div>

          <nav className='min-h-0 flex-1 overflow-y-auto p-2'>
            {rooms.length === 0 ? (
              <p className='text-muted-foreground px-2 py-6 text-center text-sm'>
                No channels yet. Create the first one.
              </p>
            ) : (
              <ul className='flex flex-col'>
                {rooms.map((room) => {
                  const active = room.id === activeChatId;
                  return (
                    <li key={room.id}>
                      <button
                        type='button'
                        onClick={() => openChannel(room.id)}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                          active
                            ? 'bg-primary text-primary-foreground'
                            : 'text-foreground hover:bg-secondary',
                        )}
                      >
                        <Hash
                          className={cn(
                            'size-4 shrink-0',
                            active
                              ? 'text-primary-foreground/80'
                              : 'text-muted-foreground',
                          )}
                          aria-hidden
                        />
                        <span className='min-w-0 flex-1 truncate font-medium'>
                          {room.name}
                        </span>
                        <span
                          className={cn(
                            'flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums',
                            active
                              ? 'bg-primary-foreground/20 text-primary-foreground'
                              : 'bg-secondary text-muted-foreground',
                          )}
                        >
                          {room.memberCount}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </nav>

          {canCreate && (
            <div className='p-2'>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant='ghost' size='sm' className='w-full'>
                    <Plus aria-hidden />
                    Create channel
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <form onSubmit={handleCreate}>
                    <DialogHeader>
                      <DialogTitle>Create a channel</DialogTitle>
                      <DialogDescription>
                        Give it a name. Anyone can find and join it.
                      </DialogDescription>
                    </DialogHeader>
                    <div className='my-5 flex flex-col gap-2'>
                      <Label htmlFor='room-name'>Channel name</Label>
                      <Input
                        id='room-name'
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder='e.g. late night talks'
                        maxLength={60}
                        autoFocus
                      />
                    </div>
                    <DialogFooter>
                      <Button type='submit' disabled={creating || !name.trim()}>
                        {creating ? 'Creating…' : 'Create & enter'}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>
        {activeChatId && (
          <div className='border-border hidden min-h-0 flex-1 flex-col border-t md:flex'>
            <div className='px-4 pt-3 pb-2'>
              <h2 className='text-muted-foreground text-xs font-semibold tracking-wider uppercase'>
                {activeChatId
                  ? `${members.length} online in this chat`
                  : 'Online'}
              </h2>
            </div>
            <div className='min-h-0 flex-1 overflow-y-auto px-3 pb-3'>
              {members.length === 0 ? (
                <p className='text-muted-foreground px-2 py-6 text-center text-sm'>
                  Connecting…
                </p>
              ) : (
                <MembersList members={members} onSelect={setPreviewUserId} />
              )}
            </div>
          </div>
        )}
      </aside>

      {/* Main pane */}
      <main
        className={cn(
          'bg-background flex min-w-0 flex-1 flex-col',
          !activeChatId && 'hidden md:flex',
        )}
      >
        {!activeChatId ? (
          <div className='flex h-full flex-col items-center justify-center gap-4 px-6 text-center'>
            <div className='bg-accent relative mb-4 flex size-28 shrink-0 items-center justify-center rounded-full'>
              <MessagesSquareIcon
                className='text-primary size-12 shrink-0'
                aria-hidden
              />
            </div>
            <div className='flex flex-col items-center gap-2'>
              <span className='text-3xl font-semibold tracking-tight text-balance'>
                Choose a Channel
              </span>
              <p className='text-muted-foreground max-w-sm text-pretty'>
                Select a channel from the left to jump into the conversation, or
                create your own.
              </p>
            </div>
          </div>
        ) : (
          <>
            <header className='border-border flex items-center gap-3 border-b px-4 py-3 sm:px-6'>
              <Button
                variant='ghost'
                size='icon'
                className='shrink-0 md:hidden'
                onClick={() => {
                  if (loadedFor.current) beaconLeave(loadedFor.current);
                  loadedFor.current = null;
                  setActiveChatId(null);
                  setMessages([]);
                  router.replace('/app/rooms', { scroll: false });
                }}
                aria-label='Back to channels'
              >
                <ArrowLeft className='size-5' aria-hidden />
              </Button>
              <div className='bg-secondary text-secondary-foreground flex size-10 shrink-0 items-center justify-center rounded-lg'>
                <Hash className='size-5' aria-hidden />
              </div>
              <div className='min-w-0 flex-1'>
                <h1 className='truncate leading-tight font-semibold'>
                  {activeRoom?.name ?? 'Channel'}
                </h1>
                <p className='text-muted-foreground flex items-center gap-1.5 text-xs'>
                  <Users className='size-3.5' aria-hidden />
                  {members.length > 0
                    ? `${members.length} online`
                    : 'Group channel'}
                </p>
              </div>
              {/* Mobile-only: open the online-members list without leaving the room. */}
              <Button
                variant='ghost'
                size='icon'
                className='md:hidden'
                onClick={() => setMembersOpen(true)}
                aria-label="Show who's online"
              >
                <Users2Icon aria-hidden />
              </Button>
              {canDelete && (
                <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                  <DialogTrigger asChild aria-label='Delete channel'>
                    <Button variant='destructive' size='icon'>
                      <Trash2Icon aria-hidden />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        Delete #{activeRoom?.name ?? 'channel'}?
                      </DialogTitle>
                      <DialogDescription>
                        This permanently deletes the channel and all of its
                        messages for everyone. This action cannot be undone.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button
                        variant='secondary'
                        onClick={() => setDeleteOpen(false)}
                        disabled={deleting}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant='destructive'
                        onClick={handleDelete}
                        disabled={deleting}
                      >
                        {deleting ? 'Deleting…' : 'Delete channel'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </header>

            <div className='min-h-0 flex-1'>
              {loading ? (
                <div className='flex h-full items-center justify-center'>
                  <Loader2
                    className='text-muted-foreground size-6 animate-spin'
                    aria-hidden
                  />
                </div>
              ) : (
                <ChatRoom
                  key={activeChatId}
                  chatId={activeChatId}
                  currentUserId={me.id}
                  currentUserName={me.name}
                  currentUserImage={me.image ?? null}
                  initialMessages={messages}
                  showSenderNames
                  onUserClickAction={setPreviewUserId}
                  notifyCategory='roomMessage'
                  emptyState={
                    <div className='text-center'>
                      <p className='text-sm font-medium'>
                        Welcome to #{activeRoom?.name ?? 'channel'}
                      </p>
                      <p className='text-muted-foreground mt-1 text-sm'>
                        Be the first to say something.
                      </p>
                    </div>
                  }
                />
              )}
            </div>
          </>
        )}
      </main>

      {/* Mobile "who's online" list. Selecting a member opens their preview. */}
      <Dialog open={membersOpen} onOpenChange={setMembersOpen}>
        <DialogContent className='max-h-[70vh] gap-0 overflow-hidden'>
          <DialogHeader>
            <DialogTitle>
              {members.length > 0
                ? `${members.length} online in this chat`
                : 'Online'}
            </DialogTitle>
            <DialogDescription>
              {activeRoom
                ? `Everyone currently in #${activeRoom.name}.`
                : 'Members currently in this channel.'}
            </DialogDescription>
          </DialogHeader>
          <div className='mt-4 min-h-0 flex-1 overflow-y-auto'>
            {members.length === 0 ? (
              <p className='text-muted-foreground px-2 py-6 text-center text-sm'>
                Connecting…
              </p>
            ) : (
              <MembersList
                members={members}
                onSelect={(id) => {
                  setMembersOpen(false);
                  setPreviewUserId(id);
                }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <UserPreviewDialog
        userId={previewUserId}
        onClose={() => setPreviewUserId(null)}
      />
    </div>
  );
}
