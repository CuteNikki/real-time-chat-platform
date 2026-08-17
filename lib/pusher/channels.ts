// Channel + event name helpers shared by client and server.

// Per-chat channel carrying new messages. Presence channel so we can count
// live members for group rooms.
export const chatChannel = (chatId: string) => `presence-chat-${chatId}`

// Per-user private channel for invites and match notifications.
export const userChannel = (userId: string) => `private-user-${userId}`

export const EVENTS = {
  NEW_MESSAGE: "new-message",
  CHAT_ENDED: "chat-ended",
  MATCH_FOUND: "match-found",
  INVITE_RECEIVED: "invite-received",
  INVITE_RESPONDED: "invite-responded",
  INVITE_CANCELED: "invite-canceled",
  // A new inbox notification (friend request/accept or new message).
  NOTIFICATION: "notification",
} as const
