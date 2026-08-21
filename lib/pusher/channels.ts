// Channel + event name helpers shared by client and server.

// Per-chat channel carrying new messages. Presence channel so we can count
// live members for group rooms.
export const chatChannel = (chatId: string) => `presence-chat-${chatId}`;

// Per-user private channel for invites and match notifications.
export const userChannel = (userId: string) => `private-user-${userId}`;

export const EVENTS = {
  NEW_MESSAGE: 'new-message',
  // A message was edited or soft-deleted; payload is the full updated
  // ChatMessage (deleted ones carry deletedAt + cleared content).
  MESSAGE_UPDATED: 'message-updated',
  CHAT_ENDED: 'chat-ended',
  // All messages in a chat were cleared by a participant.
  CHAT_CLEARED: 'chat-cleared',
  MATCH_FOUND: 'match-found',
  INVITE_RECEIVED: 'invite-received',
  INVITE_RESPONDED: 'invite-responded',
  INVITE_CANCELED: 'invite-canceled',
  // A new inbox notification (friend request/accept or new message).
  NOTIFICATION: 'notification',

  // 1-on-1 WebRTC call signaling, carried over the per-user private channel.
  // Every message of one call shares a `callId` so a listener can correlate
  // them (and ignore late signals from a call it already tore down).
  // caller→callee: the SDP offer + who's calling + whether video is requested.
  CALL_OFFER: 'call-offer',
  // callee→caller: the SDP answer accepting the call.
  CALL_ANSWER: 'call-answer',
  // both directions: a trickled ICE candidate.
  CALL_ICE: 'call-ice',
  // callee→caller: the callee rejected the incoming call.
  CALL_DECLINE: 'call-decline',
  // caller→callee: the caller gave up before it was answered (or timed out).
  CALL_CANCEL: 'call-cancel',
  // either side: an established (or ringing) call was hung up.
  CALL_END: 'call-end',
  // callee→caller: the callee is already in another call.
  CALL_BUSY: 'call-busy',
  // either side: our outbound video (camera or screen) started or stopped. Sent
  // so the peer hides/shows our feed immediately instead of waiting for the
  // receiver track's slow mute/unmute timeout (which freezes on the last frame).
  CALL_VIDEO: 'call-video',
} as const;
