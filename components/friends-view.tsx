'use client';

import { Loader2Icon, Search } from 'lucide-react';
import { useEffect, useState } from 'react';

import { searchUsers } from '@/app/actions/profile';

import type {
  FriendSummary,
  InviteSummary,
  OutgoingInviteSummary,
  UserProfile,
} from '@/lib/types';

import {
  FriendshipButtons,
  InitialProfile,
} from '@/components/friendship-buttons';
import { Input } from '@/components/ui/input';
import { UserAvatar } from '@/components/user-avatar';
import { UserPreviewDialog } from '@/components/user-preview';

export function FriendsView({
  initialIncoming,
  initialOutgoing,
  initialFriends,
}: {
  initialIncoming: InviteSummary[];
  initialOutgoing: OutgoingInviteSummary[];
  initialFriends: FriendSummary[];
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserProfile[]>([]);
  const [searching, setSearching] = useState(false);

  const [incoming, setIncoming] = useState(initialIncoming);
  const [outgoing, setOutgoing] = useState(initialOutgoing);
  const [friends, setFriends] = useState(initialFriends);

  const [previewUserId, setPreviewUserId] = useState<string | null>(null);

  // Sync server data to local state on refresh
  useEffect(() => setIncoming(initialIncoming), [initialIncoming]);
  useEffect(() => setOutgoing(initialOutgoing), [initialOutgoing]);
  useEffect(() => setFriends(initialFriends), [initialFriends]);

  // Debounced username search
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await searchUsers(q);
        setResults(res);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const handleStatusChange = (
    userId: string,
    newStatus: UserProfile['friendStatus'],
    chatId: string | null = null,
    meta: { name: string; username: string | null; image: string | null },
  ) => {
    // 1. Sync Search Results
    setResults((prev) =>
      prev.map((u) =>
        u.id === userId
          ? { ...u, friendStatus: newStatus, dmChatId: chatId ?? u.dmChatId }
          : u,
      ),
    );

    // 2. Sync Incoming (Remove if accepted or declined)
    if (newStatus === 'friends' || newStatus === 'none') {
      setIncoming((prev) => prev.filter((x) => x.senderId !== userId));
    }

    // 3. Sync Outgoing
    if (newStatus === 'outgoing') {
      setOutgoing((prev) => {
        if (prev.some((x) => x.receiverId === userId)) return prev;
        return [
          {
            id: `temp-${userId}`,
            receiverId: userId,
            receiverName: meta.name,
            receiverUsername: meta.username ?? '',
            receiverImage: meta.image ?? null,
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ];
      });
    } else if (newStatus === 'none' || newStatus === 'friends') {
      setOutgoing((prev) => prev.filter((x) => x.receiverId !== userId));
    }

    if (newStatus === 'friends') {
      setFriends((prev) => {
        if (prev.some((f) => f.id === userId)) return prev;
        return [
          {
            id: userId,
            name: meta.name,
            username: meta.username ?? '',
            image: meta.image ?? null,
            chatId: chatId,
            interests: [],
          },
          ...prev,
        ];
      });
    } else if (newStatus === 'none') {
      setFriends((prev) => prev.filter((f) => f.id !== userId));
    }
  };

  return (
    <div className='flex flex-col gap-4'>
      {/* Search Section */}
      <section>
        <div className='relative'>
          <Search
            className='text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2'
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Search by name, @username, or #interest'
            className='pl-8'
            autoCapitalize='none'
            spellCheck={false}
          />
          {searching && (
            <Loader2Icon
              className='text-muted-foreground absolute top-1/2 right-2 size-4 -translate-y-1/2 animate-spin'
              aria-hidden
            />
          )}
        </div>

        <ul className='flex flex-col gap-1 py-2'>
          {results.map((r) => (
            <UserListItem
              key={r.id}
              profile={{
                friendStatus: r.friendStatus,
                dmChatId: r.dmChatId,
                isSelf: r.isSelf,
                image: r.image,
                name: r.name,
                username: r.username ?? null,
                id: r.id,
              }}
              onClickAction={() => setPreviewUserId(r.id)}
              onUpdateAction={(status, chatId) =>
                handleStatusChange(r.id, status, chatId ?? null, r)
              }
            />
          ))}
          {query.trim().length >= 2 && !searching && results.length === 0 && (
            <EmptyRequests text={`No users found for "${query.trim()}"`} />
          )}
        </ul>
      </section>

      {/* Incoming requests */}
      <section className='space-y-2'>
        <span className='text-muted-foreground text-sm font-semibold tracking-wide uppercase'>
          Incoming requests ({incoming.length})
        </span>
        {incoming.length === 0 ? (
          <EmptyRequests text='You have no incoming requests.' />
        ) : (
          <ul className='space-y-1'>
            {incoming.map((inv) => (
              <UserListItem
                key={inv.id}
                profile={{
                  friendStatus: 'incoming',
                  dmChatId: null,
                  isSelf: false,
                  image: inv.senderImage,
                  name: inv.senderName,
                  username: inv.senderUsername,
                  id: inv.senderId,
                }}
                onClickAction={() => setPreviewUserId(inv.senderId)}
                onUpdateAction={(status, chatId) =>
                  handleStatusChange(inv.senderId, status, chatId ?? null, {
                    name: inv.senderName,
                    username: inv.senderUsername,
                    image: inv.senderImage,
                  })
                }
              />
            ))}
          </ul>
        )}
      </section>

      {/* Outgoing requests */}
      <section className='space-y-2'>
        <span className='text-muted-foreground text-sm font-semibold tracking-wide uppercase'>
          Outgoing Requests ({outgoing.length})
        </span>
        {outgoing.length === 0 ? (
          <EmptyRequests text='You have no outgoing friend requests. Search above to find people and send a request.' />
        ) : (
          <ul className='space-y-1'>
            {outgoing.map((inv) => (
              <UserListItem
                key={inv.id}
                profile={{
                  friendStatus: 'outgoing',
                  dmChatId: null,
                  isSelf: false,
                  image: inv.receiverImage,
                  name: inv.receiverName,
                  username: inv.receiverUsername,
                  id: inv.receiverId,
                }}
                onClickAction={() => setPreviewUserId(inv.receiverId)}
                onUpdateAction={(status, chatId) =>
                  handleStatusChange(inv.receiverId, status, chatId ?? null, {
                    name: inv.receiverName,
                    username: inv.receiverUsername,
                    image: inv.receiverImage,
                  })
                }
              />
            ))}
          </ul>
        )}
      </section>

      {/* Current friends */}
      <section className='space-y-2'>
        <span className='text-muted-foreground text-sm font-semibold tracking-wide uppercase'>
          Your friends ({friends.length})
        </span>
        {friends.length === 0 ? (
          <EmptyRequests text='You have no friends yet. Search above to find people and send a request.' />
        ) : (
          <ul className='space-y-1'>
            {friends.map((f) => (
              <UserListItem
                key={f.id}
                profile={{
                  ...f,
                  dmChatId: f.chatId ?? null,
                  friendStatus: 'friends',
                  isSelf: false,
                  id: f.id,
                  name: f.name,
                  username: f.username ?? null,
                }}
                onClickAction={() => setPreviewUserId(f.id)}
                onUpdateAction={(status, chatId) =>
                  handleStatusChange(f.id, status, chatId ?? null, f)
                }
              />
            ))}
          </ul>
        )}
      </section>

      <UserPreviewDialog
        userId={previewUserId}
        onCloseAction={() => setPreviewUserId(null)}
      />
    </div>
  );
}

export function UserListItem({
  profile,
  onUpdateAction,
  onClickAction,
}: {
  profile: InitialProfile;
  onClickAction: () => void;
  onUpdateAction?: (
    newStatus: UserProfile['friendStatus'],
    chatId?: string | null,
  ) => void;
}) {
  return (
    <li className='border-border bg-card flex items-center gap-2 rounded-lg border p-2'>
      <button
        type='button'
        onClick={onClickAction}
        className='shrink-0 cursor-pointer self-start'
      >
        <UserAvatar
          name={profile.name}
          image={profile.image}
          className='size-10'
        />
      </button>
      <div className='flex min-w-0 flex-1 flex-col gap-2 leading-tight'>
        <button
          type='button'
          onClick={onClickAction}
          className='cursor-pointer text-left'
        >
          <p className='truncate font-medium'>{profile.name}</p>
          {profile.username && (
            <p className='text-muted-foreground truncate text-xs'>
              @{profile.username}
            </p>
          )}
        </button>
      </div>
      <FriendshipButtons
        initialProfile={profile}
        onUpdateAction={onUpdateAction}
      />
    </li>
  );
}

export function EmptyRequests({ text }: { text: string }) {
  return (
    <p className='border-border bg-card text-muted-foreground rounded-lg border border-dashed p-4 text-center text-sm text-balance'>
      {text}
    </p>
  );
}
