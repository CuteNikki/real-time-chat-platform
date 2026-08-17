'use client';

import { chatChannel } from '@/lib/pusher/channels';
import { getPusherClient } from '@/lib/pusher/client';
import { useEffect, useState } from 'react';

export type RoomMember = {
  id: string;
  name: string;
  image: string | null;
  isMe: boolean;
};

// Reads the live presence roster for a room's channel. Names come from the
// `user_info` payload set in the Pusher auth route. This hook binds to the
// shared channel but never unsubscribes — the message subscription in
// useChat owns the channel lifecycle for the active room.
export function useRoomMembers(chatId: string | null): RoomMember[] {
  const [members, setMembers] = useState<RoomMember[]>([]);

  useEffect(() => {
    if (!chatId) {
      setMembers([]);
      return;
    }
    const pusher = getPusherClient();
    const channel = pusher.subscribe(chatChannel(chatId));

    const read = () => {
      // @ts-expect-error `members` only exists on presence channels
      const roster = channel.members;
      if (!roster) return;
      const myId: string | undefined = roster.myID;
      const list: RoomMember[] = [];
      roster.each(
        (m: {
          id: string;
          info?: { name?: string; image?: string | null };
        }) => {
          list.push({
            id: m.id,
            name: m.info?.name ?? 'Anonymous',
            image: m.info?.image ?? null,
            isMe: m.id === myId,
          });
        },
      );
      // Show me first, then everyone else alphabetically.
      list.sort((a, b) =>
        a.isMe ? -1 : b.isMe ? 1 : a.name.localeCompare(b.name),
      );
      setMembers(list);
    };

    channel.bind('pusher:subscription_succeeded', read);
    channel.bind('pusher:member_added', read);
    channel.bind('pusher:member_removed', read);
    read();

    return () => {
      channel.unbind('pusher:subscription_succeeded', read);
      channel.unbind('pusher:member_added', read);
      channel.unbind('pusher:member_removed', read);
    };
  }, [chatId]);

  return members;
}
