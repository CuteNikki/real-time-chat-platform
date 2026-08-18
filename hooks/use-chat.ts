'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Channel } from 'pusher-js';
import { getPusherClient } from '@/lib/pusher/client';
import { chatChannel, EVENTS } from '@/lib/pusher/channels';
import { useNotificationPrefs } from '@/components/notification-prefs-provider';
import { playNotificationSound } from '@/lib/notification-sound';
import type { ChatMessage, NotificationCategory } from '@/lib/types';

type PresenceMember = { id: string; info: { name: string } };

export function useChat({
  chatId,
  currentUserId,
  initialMessages,
  onEnded,
  notifyCategory = null,
}: {
  chatId: string;
  // Used to tell apart messages we sent ourselves (which never chime) from
  // ones sent by someone else.
  currentUserId: string;
  initialMessages: ChatMessage[];
  onEnded?: (payload?: { by?: string; disconnected?: boolean }) => void;
  // When set, an incoming message from someone else plays this category's
  // chime — even though having the chat open already suppresses the bell
  // popup and unread badge for it server-side (see sendMessage's presence
  // check). Pass null (default) to stay silent, e.g. for random-match chats
  // which never generate notifications either.
  notifyCategory?: NotificationCategory | null;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [ended, setEnded] = useState(false);
  const channelRef = useRef<Channel | null>(null);
  const { prefs } = useNotificationPrefs();

  // The subscribe effect below intentionally only depends on `chatId` (see
  // the eslint-disable) so it doesn't tear down and re-subscribe to Pusher
  // whenever these change. Keep them in refs so handleNew still reads
  // current values instead of whatever was captured at subscribe time.
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const notifyCategoryRef = useRef(notifyCategory);
  notifyCategoryRef.current = notifyCategory;
  const currentUserIdRef = useRef(currentUserId);
  currentUserIdRef.current = currentUserId;

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  useEffect(() => {
    const pusher = getPusherClient();
    const channel = pusher.subscribe(chatChannel(chatId));
    channelRef.current = channel;

    const handleNew = (msg: ChatMessage) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });

      const category = notifyCategoryRef.current;
      const currentPrefs = prefsRef.current;
      if (
        category &&
        msg.senderId !== currentUserIdRef.current &&
        currentPrefs.soundEnabled &&
        currentPrefs.categories[category].sound
      ) {
        playNotificationSound(category, currentPrefs.volume);
      }
    };

    const handleEnded = (payload?: { by?: string; disconnected?: boolean }) => {
      setEnded(true);
      onEnded?.(payload);
    };

    const handleCleared = () => {
      setMessages([]);
    };

    const recount = () => {
      // @ts-expect-error members exists on presence channels
      const members = channel.members;
      if (members) setMemberCount(members.count);
    };

    channel.bind(EVENTS.NEW_MESSAGE, handleNew);
    channel.bind(EVENTS.CHAT_ENDED, handleEnded);
    channel.bind(EVENTS.CHAT_CLEARED, handleCleared);
    channel.bind('pusher:subscription_succeeded', recount);
    channel.bind('pusher:member_added', recount);
    channel.bind('pusher:member_removed', recount);

    return () => {
      channel.unbind(EVENTS.NEW_MESSAGE, handleNew);
      channel.unbind(EVENTS.CHAT_ENDED, handleEnded);
      channel.unbind(EVENTS.CHAT_CLEARED, handleCleared);
      channel.unbind('pusher:subscription_succeeded', recount);
      channel.unbind('pusher:member_added', recount);
      channel.unbind('pusher:member_removed', recount);
      pusher.unsubscribe(chatChannel(chatId));
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  // Optimistically append a locally-sent message (deduped by id when the
  // realtime echo arrives).
  const appendLocal = useCallback((msg: ChatMessage) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev;
      return [...prev, msg];
    });
  }, []);

  return { messages, memberCount, ended, appendLocal };
}

export type { PresenceMember };
