'use client';

import { useEffect, useState } from 'react';
import { getPusherClient } from '@/lib/pusher/client';
import { chatChannel } from '@/lib/pusher/channels';

// Subscribes to a chat's presence channel purely to read the live member
// count for the header. The message stream itself is handled by useChat, and
// Pusher shares the single underlying subscription.
export function useChatHeader({
  chatId,
  enabled,
}: {
  chatId: string;
  enabled: boolean;
}) {
  const [memberCount, setMemberCount] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const pusher = getPusherClient();
    const channel = pusher.subscribe(chatChannel(chatId));

    const recount = () => {
      // @ts-expect-error members exists on presence channels
      const members = channel.members;
      if (members) setMemberCount(members.count);
    };

    channel.bind('pusher:subscription_succeeded', recount);
    channel.bind('pusher:member_added', recount);
    channel.bind('pusher:member_removed', recount);
    recount();

    return () => {
      channel.unbind('pusher:subscription_succeeded', recount);
      channel.unbind('pusher:member_added', recount);
      channel.unbind('pusher:member_removed', recount);
      // Do not unsubscribe here — useChat owns the subscription lifecycle.
    };
  }, [chatId, enabled]);

  return { memberCount };
}
