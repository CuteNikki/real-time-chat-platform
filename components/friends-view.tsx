'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Clock,
  Loader2,
  MessageCircle,
  MoreVertical,
  Search,
  UserMinus,
  UserPlus,
  X,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserAvatar } from '@/components/user-avatar';
import { InterestTags } from '@/components/interest-tags';
import { toast } from 'sonner';
import { searchUsers } from '@/app/actions/profile';
import {
  cancelFriendRequest,
  removeFriend,
  respondToRequest,
  sendFriendRequest,
} from '@/app/actions/invites';
import type {
  FriendSummary,
  InviteSummary,
  OutgoingInviteSummary,
} from '@/lib/types';

type SearchResult = {
  id: string;
  name: string;
  username: string;
  image: string | null;
  friendStatus: 'none' | 'friends' | 'incoming' | 'outgoing';
  interests: string[];
};

export function FriendsView({
  initialIncoming,
  initialOutgoing,
  initialFriends,
}: {
  initialIncoming: InviteSummary[];
  initialOutgoing: OutgoingInviteSummary[];
  initialFriends: FriendSummary[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [incoming, setIncoming] = useState(initialIncoming);
  const [outgoing, setOutgoing] = useState(initialOutgoing);
  const [friends, setFriends] = useState(initialFriends);
  const [busy, setBusy] = useState<string | null>(null);

  // Debounced username search.
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

  async function addFriend(target: SearchResult) {
    setBusy(target.id);
    try {
      const res = await sendFriendRequest(target.id);
      setResults((rs) =>
        rs.map((r) =>
          r.id === target.id ? { ...r, friendStatus: 'outgoing' } : r,
        ),
      );
      // Reflect the new request in the "Sent" list immediately.
      const inviteId =
        res && 'id' in res ? (res.id as string) : `pending-${target.id}`;
      setOutgoing((o) =>
        o.some((x) => x.receiverId === target.id)
          ? o
          : [
              {
                id: inviteId,
                receiverId: target.id,
                receiverName: target.name,
                receiverUsername: target.username,
                receiverImage: target.image,
                createdAt: new Date().toISOString(),
              },
              ...o,
            ],
      );
      toast.success(
        `Request sent to ${target.username ? '@' + target.username : target.name}`,
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Could not send request',
      );
    } finally {
      setBusy(null);
    }
  }

  async function cancelRequest(targetUserId: string) {
    setBusy(targetUserId);
    try {
      await cancelFriendRequest(targetUserId);
      setResults((rs) =>
        rs.map((r) =>
          r.id === targetUserId ? { ...r, friendStatus: 'none' } : r,
        ),
      );
      setOutgoing((o) => o.filter((x) => x.receiverId !== targetUserId));
      toast.success('Request canceled');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not cancel');
    } finally {
      setBusy(null);
    }
  }

  async function respond(inv: InviteSummary, accept: boolean) {
    setBusy(inv.id);
    try {
      const res = await respondToRequest(inv.id, accept);
      setIncoming((p) => p.filter((x) => x.id !== inv.id));
      if (accept && res?.chatId) {
        toast.success("You're now friends");
        router.push(`/app/messages?c=${res.chatId}`);
      } else {
        toast.success(accept ? "You're now friends" : 'Request declined');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not respond');
    } finally {
      setBusy(null);
    }
  }

  async function unfriend(friend: FriendSummary) {
    setBusy(friend.id);
    try {
      await removeFriend(friend.id);
      setFriends((f) => f.filter((x) => x.id !== friend.id));
      // Reflect in any current search results too.
      setResults((rs) =>
        rs.map((r) =>
          r.id === friend.id ? { ...r, friendStatus: 'none' } : r,
        ),
      );
      toast.success(
        `Removed ${friend.username ? '@' + friend.username : friend.name} and deleted your chat`,
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Could not remove friend',
      );
    } finally {
      setBusy(null);
    }
  }

  function actionLabel(status: SearchResult['friendStatus']) {
    if (status === 'friends') return 'Friends';
    if (status === 'outgoing') return 'Requested';
    if (status === 'incoming') return 'Respond';
    return 'Add friend';
  }

  return (
    <div className='space-y-8'>
      {/* Search — the primary action, kept at the top so pending requests
          never push it down the page. */}
      <section>
        <div className='relative'>
          <Search
            className='text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2'
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Search by name, @username, or #interest'
            className='pl-9'
            autoCapitalize='none'
            spellCheck={false}
          />
          {searching ? (
            <Loader2
              className='text-muted-foreground absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin'
              aria-hidden
            />
          ) : null}
        </div>

        <ul className='mt-3 flex flex-col gap-2'>
          {results.map((r) => (
            <li
              key={r.id}
              className='border-border bg-card flex items-center gap-3 rounded-lg border p-3'
            >
              <Link href={r.username ? `/app/u/${r.username}` : '#'}>
                <UserAvatar name={r.name} image={r.image} className='size-10' />
              </Link>
              <div className='min-w-0 flex-1 leading-tight'>
                <Link
                  href={r.username ? `/app/u/${r.username}` : '#'}
                  className='hover:underline'
                >
                  <p className='truncate font-medium'>{r.name}</p>
                  {r.username ? (
                    <p className='text-muted-foreground truncate text-xs'>
                      @{r.username}
                    </p>
                  ) : null}
                </Link>
                <InterestTags
                  interests={r.interests}
                  className='mt-1'
                  max={4}
                />
              </div>
              {r.friendStatus === 'incoming' ? (
                <Link href='#requests'>
                  <Button size='sm' variant='secondary'>
                    Respond
                  </Button>
                </Link>
              ) : r.friendStatus === 'outgoing' ? (
                <Button
                  size='sm'
                  variant='secondary'
                  className='group/req gap-1.5'
                  disabled={busy === r.id}
                  onClick={() => cancelRequest(r.id)}
                >
                  {busy === r.id ? (
                    <Loader2 className='size-4 animate-spin' aria-hidden />
                  ) : (
                    <>
                      <Clock
                        className='size-4 group-hover/req:hidden'
                        aria-hidden
                      />
                      <X
                        className='hidden size-4 group-hover/req:block'
                        aria-hidden
                      />
                    </>
                  )}
                  <span className='group-hover/req:hidden'>Requested</span>
                  <span className='hidden group-hover/req:inline'>Cancel</span>
                </Button>
              ) : (
                <Button
                  size='sm'
                  variant={r.friendStatus === 'none' ? 'default' : 'secondary'}
                  className='gap-1.5'
                  disabled={r.friendStatus !== 'none' || busy === r.id}
                  onClick={() => addFriend(r)}
                >
                  {busy === r.id ? (
                    <Loader2 className='size-4 animate-spin' aria-hidden />
                  ) : r.friendStatus === 'none' ? (
                    <UserPlus className='size-4' aria-hidden />
                  ) : null}
                  {actionLabel(r.friendStatus)}
                </Button>
              )}
            </li>
          ))}
          {query.trim().length >= 2 && !searching && results.length === 0 ? (
            <li className='border-border text-muted-foreground rounded-lg border border-dashed py-8 text-center text-sm'>
              No users found for &ldquo;{query.trim()}&rdquo;
            </li>
          ) : null}
        </ul>
      </section>

      {/* Incoming requests */}
      {incoming.length > 0 ? (
        <section id='requests'>
          <h2 className='text-muted-foreground mb-3 text-sm font-semibold tracking-wide uppercase'>
            Incoming requests ({incoming.length})
          </h2>
          <ul className='flex flex-col gap-2'>
            {incoming.map((inv) => (
              <li
                key={inv.id}
                className='border-border bg-card flex items-center gap-3 rounded-lg border p-3'
              >
                <Link
                  href={
                    inv.senderUsername ? `/app/u/${inv.senderUsername}` : '#'
                  }
                >
                  <UserAvatar
                    name={inv.senderName}
                    image={inv.senderImage}
                    className='size-10'
                  />
                </Link>
                <div className='min-w-0 flex-1 leading-tight'>
                  <p className='truncate font-medium'>{inv.senderName}</p>
                  {inv.senderUsername ? (
                    <p className='text-muted-foreground truncate text-xs'>
                      @{inv.senderUsername}
                    </p>
                  ) : null}
                </div>
                <div className='flex gap-2'>
                  <Button
                    size='sm'
                    onClick={() => respond(inv, true)}
                    disabled={busy === inv.id}
                  >
                    Accept
                  </Button>
                  <Button
                    size='sm'
                    variant='ghost'
                    onClick={() => respond(inv, false)}
                    disabled={busy === inv.id}
                  >
                    Decline
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Current friends */}
      <section>
        <h2 className='text-muted-foreground mb-3 text-sm font-semibold tracking-wide uppercase'>
          Your friends ({friends.length})
        </h2>
        {friends.length === 0 ? (
          <p className='border-border text-muted-foreground rounded-lg border border-dashed py-8 text-center text-sm text-balance'>
            You have no friends yet. Search above to find people and send a
            request.
          </p>
        ) : (
          <ul className='flex flex-col gap-2'>
            {friends.map((f) => (
              <li
                key={f.id}
                className='border-border bg-card flex items-center gap-3 rounded-lg border p-3'
              >
                <Link href={f.username ? `/app/u/${f.username}` : '#'}>
                  <UserAvatar
                    name={f.name}
                    image={f.image}
                    className='size-10'
                  />
                </Link>
                <div className='min-w-0 flex-1 leading-tight'>
                  <Link
                    href={f.username ? `/app/u/${f.username}` : '#'}
                    className='hover:underline'
                  >
                    <p className='truncate font-medium'>{f.name}</p>
                    {f.username ? (
                      <p className='text-muted-foreground truncate text-xs'>
                        @{f.username}
                      </p>
                    ) : null}
                  </Link>
                </div>
                <div className='flex shrink-0 items-center gap-1'>
                  {f.chatId ? (
                    <Button
                      size='sm'
                      variant='secondary'
                      className='gap-1.5'
                      render={<Link href={`/app/messages?c=${f.chatId}`} />}
                    >
                      <MessageCircle className='size-4' aria-hidden />
                      Message
                    </Button>
                  ) : null}
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          size='icon'
                          variant='ghost'
                          className='size-8'
                          disabled={busy === f.id}
                          aria-label={`More actions for ${f.name}`}
                        />
                      }
                    >
                      {busy === f.id ? (
                        <Loader2 className='size-4 animate-spin' aria-hidden />
                      ) : (
                        <MoreVertical className='size-4' aria-hidden />
                      )}
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align='end'>
                      <DropdownMenuItem
                        variant='destructive'
                        onClick={() => unfriend(f)}
                      >
                        <UserMinus className='size-4' aria-hidden />
                        Unfriend
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Outgoing (sent) requests — lets you pull back a request even if you
          can no longer find that user in search. */}
      {outgoing.length > 0 ? (
        <section>
          <h2 className='text-muted-foreground mb-3 text-sm font-semibold tracking-wide uppercase'>
            Sent requests ({outgoing.length})
          </h2>
          <ul className='flex flex-col gap-2'>
            {outgoing.map((inv) => (
              <li
                key={inv.id}
                className='border-border bg-card flex items-center gap-3 rounded-lg border p-3'
              >
                <Link
                  href={
                    inv.receiverUsername
                      ? `/app/u/${inv.receiverUsername}`
                      : '#'
                  }
                >
                  <UserAvatar
                    name={inv.receiverName}
                    image={inv.receiverImage}
                    className='size-10'
                  />
                </Link>
                <div className='min-w-0 flex-1 leading-tight'>
                  <p className='truncate font-medium'>{inv.receiverName}</p>
                  {inv.receiverUsername ? (
                    <p className='text-muted-foreground truncate text-xs'>
                      @{inv.receiverUsername}
                    </p>
                  ) : null}
                </div>
                <Button
                  size='sm'
                  variant='secondary'
                  className='group/req gap-1.5'
                  disabled={busy === inv.receiverId}
                  onClick={() => cancelRequest(inv.receiverId)}
                >
                  {busy === inv.receiverId ? (
                    <Loader2 className='size-4 animate-spin' aria-hidden />
                  ) : (
                    <>
                      <Clock
                        className='size-4 group-hover/req:hidden'
                        aria-hidden
                      />
                      <X
                        className='hidden size-4 group-hover/req:block'
                        aria-hidden
                      />
                    </>
                  )}
                  <span className='group-hover/req:hidden'>Pending</span>
                  <span className='hidden group-hover/req:inline'>Cancel</span>
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
