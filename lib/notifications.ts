// Client-safe presenters for notifications. Given a notification's STRUCTURED
// fields (type + metadata), these compose the display text. Presentation lives
// here — in one place — so the notification bell, toast popups, and any future
// surface render identically and never embed the actor's name in stored data.

import type {
  NotificationCategory,
  NotificationMetadata,
  NotificationType,
} from '@/lib/types';

// The inbox tab a notification belongs to.
export type NotificationTab = 'requests' | 'messages' | 'likes' | 'mentions';

export function tabForType(type: NotificationType): NotificationTab {
  if (type === 'MESSAGE') return 'messages';
  if (type === 'LIKE') return 'likes';
  if (type === 'MENTION') return 'mentions';
  return 'requests';
}

// Map a notification to its preference category. MESSAGE is ambiguous (direct
// vs room), so metadata.chatType disambiguates; a realtime payload's explicit
// category still takes precedence over this fallback.
export function categoryForType(
  type: NotificationType,
  metadata?: NotificationMetadata | null,
): NotificationCategory {
  switch (type) {
    case 'FRIEND_REQUEST':
      return 'friendRequest';
    case 'FRIEND_ACCEPT':
      return 'friendAccept';
    case 'LIKE':
      return 'like';
    case 'MENTION':
      return 'mention';
    default:
      return metadata?.chatType === 'GROUP' ? 'roomMessage' : 'directMessage';
  }
}

// The action clause that follows the actor's name, e.g. the "sent you a friend
// request" in "Alex sent you a friend request". The name is rendered separately
// by the UI, so it appears exactly once.
export function notificationActionText(
  type: NotificationType,
  metadata?: NotificationMetadata | null,
): string {
  switch (type) {
    case 'FRIEND_REQUEST':
      return 'sent you a friend request';
    case 'FRIEND_ACCEPT':
      return 'accepted your friend request';
    case 'LIKE':
      return 'liked your post';
    case 'MENTION':
      return metadata?.mentionSource === 'profile'
        ? 'tagged you in their profile'
        : 'tagged you in their post';
    default:
      return metadata?.roomName
        ? `messaged ${metadata.roomName}`
        : 'sent you a message';
  }
}

// The secondary preview line (message body), if any. Null for types that have
// no preview, so callers can omit the line entirely.
export function notificationPreview(
  metadata?: NotificationMetadata | null,
): string | null {
  const preview = metadata?.preview?.trim();
  return preview ? preview : null;
}

// Deep-link for a MESSAGE notification. Group-room and direct messages live in
// separate workspaces (/app/rooms vs /app/messages), so the destination is
// chosen from metadata.chatType — routing a room message to the DM workspace
// would open a chat that workspace can't display. Returns null when there's no
// chat to open.
export function notificationChatHref(
  chatId: string | null,
  metadata?: NotificationMetadata | null,
): string | null {
  if (!chatId) return null;
  const base = metadata?.chatType === 'GROUP' ? '/app/rooms' : '/app/messages';
  return `${base}?c=${chatId}`;
}
