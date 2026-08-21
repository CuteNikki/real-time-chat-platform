'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import useSWR from 'swr';

import {
  ArrowLeftIcon,
  HashIcon,
  Loader2Icon,
  MessageCircleQuestionMarkIcon,
  MessagesSquareIcon,
  Plus,
  Trash2Icon,
  Users2Icon,
} from 'lucide-react';

import { getMessages } from '@/app/actions/chat';
import { createRoom, deleteRoom } from '@/app/actions/rooms';

import { RoomMember, useRoomMembers } from '@/hooks/use-room-members';
import { useScrollFade } from '@/hooks/use-scroll-fade';

import type { ChatMessage, RoomSummary } from '@/lib/types';
import { cn } from '@/lib/utils';

import { ChatRoom } from '@/components/chat/chat-room';
import { Badge } from '@/components/ui/badge';
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
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserAvatar } from '@/components/user/user-avatar';
import { UserPreviewDialog } from '@/components/user/user-preview';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function MembersList({
  members,
  onSelect,
}: {
  members: RoomMember[];
  onSelect: (id: string) => void;
}) {
  return (
    <ul className='flex flex-col gap-1'>
      {members.map((m) => (
        <li key={m.id}>
          <Button
            onClick={() => onSelect(m.id)}
            size='lg'
            variant='secondary'
            className='w-full justify-start text-left'
          >
            <UserAvatar
              name={m.name}
              image={m.image ?? null}
              className='size-6'
            />
            <span className='min-w-0 flex-1 truncate text-base'>{m.name}</span>
          </Button>
        </li>
      ))}
    </ul>
  );
}

// Gradient that fades a scroll container's top or bottom edge, shown only when
// there's hidden content in that direction. `from` picks the surface colour to
// fade from (the pane background vs. a card/dialog).
function EdgeFade({
  side,
  from,
  show,
}: {
  side: 'top' | 'bottom';
  from: 'background' | 'card';
  show: boolean;
}) {
  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-x-0 z-10 h-12 to-transparent transition-opacity duration-200',
        side === 'top' ? '-top-1 bg-linear-to-b' : '-bottom-1 bg-linear-to-t',
        from === 'background' ? 'from-background' : 'from-card',
        show ? 'opacity-100' : 'opacity-0',
      )}
      aria-hidden
    />
  );
}

export function RoomsWorkspace({
  initialRooms,
  me,
  canCreate = false,
  canDelete = false,
  canModerate = false,
}: {
  initialRooms: RoomSummary[];
  me: { id: string; name: string; image: string | null };
  canCreate?: boolean;
  canDelete?: boolean;
  // Moderator/admin viewer: enables removing other users' messages in channels.
  canModerate?: boolean;
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
  // Start in the loading state when the URL already points at a channel (e.g. a
  // page reload inside a room) so the chat pane shows a spinner instead of
  // mounting ChatRoom with empty history and immediately unmounting it once the
  // fetch flips loading on — that churn used to tear the shared presence
  // channel down under the member list.
  const [loading, setLoading] = useState(!!urlChatId);

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

  // Edge-fade tracking for the three independently-scrolling panes: the channel
  // list, the desktop member list, and the mobile members dialog.
  const channelFade = useScrollFade<HTMLDivElement>();
  const userFade = useScrollFade<HTMLDivElement>();
  const mobileUserFade = useScrollFade<HTMLDivElement>();

  const members = useRoomMembers(activeChatId);
  const activeRoom = rooms.find((r) => r.id === activeChatId) ?? null;

  // Track the last channel we loaded so re-renders don't refetch endlessly.
  const loadedFor = useRef<string | null>(null);

  // Rooms are public drop-in channels — occupancy is tracked purely by Pusher
  // presence (see useRoomMembers / listRooms), so opening one just loads its
  // history and syncs the URL. No join/leave bookkeeping to race on reload.
  const openChannel = useCallback(
    async (chatId: string) => {
      if (loadedFor.current === chatId) return;
      loadedFor.current = chatId;
      setActiveChatId(chatId);
      setLoading(true);
      router.replace(`/app/rooms?c=${chatId}`, { scroll: false });
      try {
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
    [router, mutate],
  );

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

  useEffect(() => {
    channelFade.check();
    userFade.check();
    mobileUserFade.check();
  }, [
    rooms.length,
    members.length,
    channelFade.check,
    userFade.check,
    mobileUserFade.check,
  ]);

  async function handleCreate(e: React.SubmitEvent) {
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
          <div className='relative min-h-0 flex-1'>
            <nav
              className='xs:p-4 h-full overflow-y-auto p-2'
              ref={channelFade.ref}
              onScroll={channelFade.check}
            >
              {rooms.length === 0 ? (
                <p className='text-muted-foreground px-2 py-6 text-center text-sm'>
                  No channels yet. Create the first one.
                </p>
              ) : (
                <ul className='flex flex-col gap-1'>
                  {rooms.map((room) => {
                    const active = room.id === activeChatId;
                    return (
                      <li key={room.id}>
                        <Button
                          onClick={() => openChannel(room.id)}
                          className='w-full justify-between gap-2'
                          variant={active ? 'default' : 'secondary'}
                          size='lg'
                        >
                          <div className='flex min-w-0 flex-1 items-center gap-2 text-left'>
                            <HashIcon
                              className={cn(
                                'shrink-0',
                                active
                                  ? 'text-primary-foreground'
                                  : 'text-muted-foreground',
                              )}
                              aria-hidden
                            />
                            <span className='truncate font-medium'>
                              {room.name}
                            </span>
                          </div>
                          {room.memberCount > 0 && (
                            <Badge
                              variant={active ? 'secondary' : 'default'}
                              className='shrink-0'
                            >
                              {room.memberCount}
                            </Badge>
                          )}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </nav>
            <EdgeFade
              side='top'
              from='background'
              show={channelFade.scrollable && !channelFade.atTop}
            />
            <EdgeFade
              side='bottom'
              from='background'
              show={channelFade.scrollable && !channelFade.atBottom}
            />
          </div>

          {canCreate && (
            <div className='p-2'>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant='secondary' size='lg' className='w-full'>
                    <Plus aria-hidden />
                    Create Channel
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <form onSubmit={handleCreate}>
                    <DialogHeader>
                      <DialogTitle>Create a Channel</DialogTitle>
                      <DialogDescription>
                        Give it a name. Anyone can find and join it.
                      </DialogDescription>
                    </DialogHeader>
                    <div className='flex flex-col gap-2 py-4'>
                      <Label htmlFor='room-name'>Channel Name</Label>
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
                        {creating ? 'Creating…' : 'Create'}
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
            <div className='p-4 pb-2'>
              <span className='text-muted-foreground text-xs font-semibold tracking-wider uppercase'>
                {`${members.length} online in this chat`}
              </span>
            </div>

            <div className='relative min-h-0 flex-1'>
              <div
                className='xs:p-4 h-full scrollbar-none overflow-y-auto p-2 pt-0!'
                ref={userFade.ref}
                onScroll={userFade.check}
              >
                {members.length === 0 ? (
                  <div className='flex h-full items-center justify-center py-4'>
                    <Loader2Icon className='animate-spin' aria-hidden />
                  </div>
                ) : (
                  <MembersList members={members} onSelect={setPreviewUserId} />
                )}
              </div>
              <EdgeFade
                side='top'
                from='background'
                show={userFade.scrollable && !userFade.atTop}
              />
              <EdgeFade
                side='bottom'
                from='background'
                show={userFade.scrollable && !userFade.atBottom}
              />
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
          <EmptyState
            icon={MessagesSquareIcon}
            title='Choose a channel'
            description='Select a channel from the left to jump into the conversation, or create your own.'
            className='h-full'
          />
        ) : (
          <>
            <header className='border-border xs:p-4 flex items-center gap-2 border-b p-2'>
              <Button
                variant='ghost'
                size='icon-lg'
                className='shrink-0 md:hidden'
                onClick={() => {
                  loadedFor.current = null;
                  setActiveChatId(null);
                  setMessages([]);
                  router.replace('/app/rooms', { scroll: false });
                }}
                aria-label='Back to channels'
              >
                <ArrowLeftIcon aria-hidden />
              </Button>
              <div className='flex min-w-0 flex-1 items-center gap-2'>
                <HashIcon
                  className='text-muted-foreground size-4 shrink-0 -translate-y-px'
                  aria-hidden
                />
                <span className='truncate font-semibold'>
                  {activeRoom?.name ?? 'Channel'}
                </span>
              </div>
              <div className='text-muted-foreground flex items-center gap-2 text-sm md:hidden'>
                <Button
                  variant='secondary'
                  size='lg'
                  className='text-foreground'
                  onClick={() => setMembersOpen(true)}
                >
                  <span>{members.length}</span>
                  <Users2Icon aria-hidden />
                </Button>
              </div>
              {canDelete && (
                <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                  <DialogTrigger asChild aria-label='Delete channel'>
                    <Button variant='destructive' size='icon-lg'>
                      <Trash2Icon aria-hidden />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Delete Channel?</DialogTitle>
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
                        {deleting ? 'Deleting…' : 'Delete'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </header>

            <div className='min-h-0 flex-1'>
              {loading ? (
                <div className='flex h-full items-center justify-center'>
                  <Loader2Icon
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
                  canModerate={canModerate}
                  emptyState={
                    <EmptyState
                      icon={MessageCircleQuestionMarkIcon}
                      title='No messages yet'
                      description='Be the first to say something.'
                      className='h-full'
                    />
                  }
                />
              )}
            </div>
          </>
        )}
      </main>

      <Dialog open={membersOpen} onOpenChange={setMembersOpen}>
        <DialogContent className='max-h-[70vh] gap-4 overflow-hidden'>
          <DialogHeader>
            <DialogTitle>Members in this Channel</DialogTitle>
            <DialogDescription>
              {activeRoom
                ? `There's currently ${members.length} member(s) in ${activeRoom.name}.`
                : `There's currently no active room.`}
            </DialogDescription>
          </DialogHeader>
          <div className='relative min-w-0'>
            <div
              className='max-h-[60vh] min-w-0 overflow-y-auto'
              ref={mobileUserFade.ref}
              onScroll={mobileUserFade.check}
            >
              {members.length === 0 ? (
                <div className='flex h-full items-center justify-center py-4'>
                  <Loader2Icon className='animate-spin' aria-hidden />
                </div>
              ) : (
                <MembersList
                  members={members}
                  onSelect={(id) => {
                    setMembersOpen(false);
                    setPreviewUserId(id);
                  }}
                />
              )}
              {/* Top Fade */}
              <EdgeFade
                side='top'
                from='card'
                show={mobileUserFade.scrollable && !mobileUserFade.atTop}
              />
              {/* Bottom Fade */}
              <EdgeFade
                side='bottom'
                from='card'
                show={mobileUserFade.scrollable && !mobileUserFade.atBottom}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <UserPreviewDialog
        userId={previewUserId}
        onCloseAction={() => setPreviewUserId(null)}
      />
    </div>
  );
}
