export type ChatType = 'RANDOM' | 'GROUP' | 'PRIVATE';

// A lightweight snapshot of the message a reply points at, denormalized onto
// the replying message so the quoted preview always renders — even when the
// original is older than the currently-loaded page and hasn't been fetched yet.
export type ReplyPreview = {
  id: string;
  senderId: string;
  senderName: string;
  content: string | null;
  imageUrl: string | null;
  deletedAt: string | null;
};

// A chat message is either a normal USER message (text/image, possibly a reply)
// or a SYSTEM message: an automated, non-user event rendered as a centered
// notice in the thread. SYSTEM messages carry structured `meta` describing the
// event (a call summary, a moderation notice) instead of free-form content —
// the UI composes their wording from `meta`, never from a stored sentence.
export type ChatMessageKind = 'USER' | 'SYSTEM';

// Voice vs. video, and how a call ended, for a CALL system message.
export type CallMedia = 'VOICE' | 'VIDEO';
export type CallOutcome = 'COMPLETED' | 'MISSED' | 'DECLINED';

// The structured payload on a SYSTEM message. A discriminated union so the
// renderer can switch on `kind` and compose the notice from atomic fields
// rather than a pre-formatted string.
export type SystemMessageMeta =
  | {
      kind: 'CALL';
      media: CallMedia;
      outcome: CallOutcome;
      // Connected talk time in seconds (0 for a missed/declined call).
      durationSec: number;
    }
  | { kind: 'REPORT_FILED'; reference: string }
  | {
      kind: 'REPORT_RESOLVED';
      reference: string;
      verdict: 'GUILTY' | 'NOT_GUILTY';
    }
  | { kind: 'PROFILE_RESET' }
  | { kind: 'POST_REMOVED' }
  | { kind: 'MESSAGE_REMOVED' };

export type ChatMessage = {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  senderImage: string | null;
  // 'USER' for normal messages; 'SYSTEM' for automated notices (call summaries,
  // moderation DMs). Drives whether the client renders a bubble or a centered
  // notice composed from `meta`.
  kind: ChatMessageKind;
  // Structured context for a SYSTEM message; null for USER messages.
  meta: SystemMessageMeta | null;
  content: string | null;
  imageUrl: string | null;
  // Id of the message this one replies to, if any.
  replyToId: string | null;
  // Snapshot of the replied-to message so its quote renders without needing
  // that message to be loaded in the client's list. Null when not a reply (or
  // when the target could not be resolved).
  replyTo: ReplyPreview | null;
  // ISO timestamp of the last edit, or null if never edited.
  editedAt: string | null;
  // ISO timestamp when soft-deleted, or null. When set, content/imageUrl are
  // null and the UI renders a "message deleted" tombstone.
  deletedAt: string | null;
  createdAt: string;
};

export type RoomSummary = {
  id: string;
  name: string;
  memberCount: number;
  createdAt: string;
};

export type InviteSummary = {
  id: string;
  senderId: string;
  senderName: string;
  senderUsername: string;
  senderImage: string | null;
  receiverId: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  chatId: string | null;
  createdAt: string;
};

export type OutgoingInviteSummary = {
  id: string;
  receiverId: string;
  receiverName: string;
  receiverUsername: string;
  receiverImage: string | null;
  createdAt: string;
};

export type FriendSummary = {
  id: string;
  name: string;
  username: string;
  image: string | null;
  // The private DM chat with this friend, if one exists.
  chatId: string | null;
  interests: string[];
};

export type UserProfile = {
  id: string;
  name: string;
  username: string;
  image: string | null;
  bio: string | null;
  interests: string[];
  role: 'ADMIN' | 'MODERATOR' | 'MEMBER';
  postCount: number;
  friendCount: number;
  createdAt: string;
  // Relationship of the viewer to this profile.
  isSelf: boolean;
  friendStatus: 'none' | 'friends' | 'incoming' | 'outgoing';
  // If a DM chat already exists between viewer and this user.
  dmChatId: string | null;
  // Whether this profile's owner restricts posts to friends only.
  friendsOnlyPosts: boolean;
  // Whether the viewer is allowed to see this profile's posts, given
  // friendsOnlyPosts + the viewer's relationship to the owner.
  postsVisible: boolean;
};

export type NotificationType =
  'FRIEND_REQUEST' | 'FRIEND_ACCEPT' | 'MESSAGE' | 'LIKE' | 'MENTION';

// ---------------------------------------------------------------------------
// Reports (user / post / message moderation queue)
// ---------------------------------------------------------------------------

// What a report targets. A report always names a reported user; `POST` and
// `MESSAGE` additionally pin the specific content.
export type ReportTargetKind = 'USER' | 'POST' | 'MESSAGE';

export type ReportStatus = 'PENDING' | 'RESOLVED';
export type ReportVerdict = 'GUILTY' | 'NOT_GUILTY';

// One row in the moderator Reports queue: the report plus enough joined context
// (both parties' display fields, and a snapshot of the reported content) to
// triage it without a follow-up fetch.
export type ReportListItem = {
  id: string;
  reference: string;
  target: ReportTargetKind;
  reason: string | null;
  status: ReportStatus;
  verdict: ReportVerdict | null;
  createdAt: string;
  reviewedAt: string | null;
  // The moderator/admin who resolved the report, joined for the history. Null
  // while still pending, or if that account was later deleted.
  reviewedBy: {
    id: string;
    name: string;
    username: string | null;
    image: string | null;
  } | null;
  reporter: {
    id: string;
    name: string;
    username: string | null;
    image: string | null;
  } | null;
  reportedUser: {
    id: string;
    name: string;
    username: string | null;
    image: string | null;
  } | null;
  // The chat the reported message lived in, for moderation context. Null unless
  // the report targets a message.
  chatId: string | null;
  // Snapshot of the reported post, if the report targets one. Retained (with
  // `deleted: true`) for 30 days after removal so the report stays verifiable;
  // null only if the post was hard-purged past the window.
  post: {
    id: string;
    imageUrl: string | null;
    caption: string | null;
    deleted: boolean;
  } | null;
  // Snapshot of the reported chat message, if the report targets one. Content is
  // retained (with `deleted: true`) after removal so a moderator can still see
  // what was reported; null only once hard-purged past the retention window.
  message: {
    id: string;
    content: string | null;
    imageUrl: string | null;
    deleted: boolean;
  } | null;
};

// One message in the surrounding conversation shown when reviewing a reported
// message. Ordered oldest-first around the reported message so a moderator can
// read the exchange in context. Content is the raw stored text even for
// soft-deleted rows (moderation must be able to see what was said), with
// `deleted` flagging that it's no longer visible to normal readers.
export type ReportedMessageContextItem = {
  id: string;
  senderId: string;
  senderName: string;
  senderImage: string | null;
  // True for automated SYSTEM notices (call summaries, moderation DMs) rather
  // than a user-authored message.
  system: boolean;
  content: string | null;
  imageUrl: string | null;
  deleted: boolean;
  createdAt: string;
  // The single message this report actually targets, to highlight in the thread.
  isReported: boolean;
  // Whether this message's sender is the reported user (to tint their side).
  isReportedUser: boolean;
};

// Structured, raw context stored on a notification for rendering. It never
// holds a pre-formatted sentence: the actor's name is joined live from `user`
// and composed on the client, so it can't be duplicated in the display.
export type NotificationMetadata = {
  // MESSAGE: a short preview of the message (text, or "Sent an image").
  preview?: string;
  // MESSAGE from a GROUP room: the room's display name (for "messaged {room}").
  roomName?: string;
  // MESSAGE: distinguishes a direct DM from a group-room message.
  chatType?: 'PRIVATE' | 'GROUP';
  // MENTION: where the @tag happened, picking the sentence ("tagged you in
  // their post" vs "…their profile") and the deep-link the client builds.
  mentionSource?: 'post' | 'profile';
};

export type NotificationSummary = {
  id: string;
  type: NotificationType;
  actorId: string | null;
  actorName: string | null;
  actorUsername: string | null; // null only when the actor account is gone
  actorImage: string | null;
  // The entity the notification points at: chatId for MESSAGE / FRIEND_ACCEPT,
  // postId for LIKE and post @mentions, actorId for FRIEND_REQUEST and profile
  // @mentions.
  targetId: string;
  // Convenience projections of targetId by type, for deep-linking in the UI.
  chatId: string | null;
  postId: string | null;
  // Structured render context (message preview, room name, …). Null when the
  // notification type carries no extra payload.
  metadata: NotificationMetadata | null;
  // LIKE and post @mentions: a lightweight preview of the target post, joined
  // live from `post` at read time (so an edited caption stays fresh and a
  // since-deleted post simply drops to null). Null for every other type.
  post: { imageUrl: string | null; caption: string | null } | null;
  read: boolean;
  createdAt: string;
  // For FRIEND_REQUEST notifications: the still-pending invite id, so the
  // request can be accepted/declined inline. Null once handled or gone.
  inviteId: string | null;
};

// The clean, structured payload pushed over Pusher for a new notification.
// Carries the actor's display fields so the client can compose a rich toast
// (avatar + name + action + preview) without a follow-up fetch.
export type NotificationRealtimePayload = {
  id: string;
  type: NotificationType;
  // Preference category, so the client can honor per-category popup/sound prefs.
  category: NotificationCategory;
  actor: {
    id: string;
    name: string;
    username: string | null;
    image: string | null;
  } | null;
  targetId: string;
  chatId: string | null;
  postId: string | null;
  metadata: NotificationMetadata | null;
  createdAt: string;
};

// ---------------------------------------------------------------------------
// 1-on-1 WebRTC calling
// ---------------------------------------------------------------------------

// The lightweight identity of the other party in a call, carried on a
// CALL_OFFER so the recipient can render the ringing UI (avatar + name)
// without a follow-up fetch. The server stamps this from the authenticated
// caller, so it can't be spoofed.
export type CallPeer = {
  id: string;
  name: string;
  image: string | null;
};

// The SDP offer that opens a call: who's calling, the chat it belongs to, and
// whether the caller is requesting video (audio-only calls still negotiate a
// disabled video track so the camera can be turned on mid-call without
// renegotiation).
export type CallOfferPayload = {
  callId: string;
  chatId: string;
  from: CallPeer;
  sdp: RTCSessionDescriptionInit;
  video: boolean;
};

// The SDP answer accepting a call.
export type CallAnswerPayload = {
  callId: string;
  from: CallPeer;
  sdp: RTCSessionDescriptionInit;
};

// A single trickled ICE candidate for an in-progress negotiation.
export type CallIcePayload = {
  callId: string;
  from: CallPeer;
  candidate: RTCIceCandidateInit;
};

// Decline / cancel / end / busy all carry only the correlating call id (the
// server stamps `from` on every signal, so it rides along here too).
export type CallControlPayload = {
  callId: string;
  from: CallPeer;
};

// A live toggle of the sender's outbound video (camera or screen). `on: false`
// lets the peer clear our feed the instant we stop, rather than holding the last
// decoded frame until the receiver track's mute timeout eventually fires.
export type CallVideoPayload = {
  callId: string;
  from: CallPeer;
  on: boolean;
};

export type PostSummary = {
  id: string;
  authorId: string;
  authorName: string;
  authorUsername: string;
  authorImage: string | null;
  // Null for text-only posts.
  imageUrl: string | null;
  caption: string | null;
  createdAt: string;
  likeCount: number;
  likedByMe: boolean;
  // Whether the viewer owns this post (can edit/delete it).
  canManage: boolean;
};

export type PostLiker = {
  id: string;
  name: string;
  username: string;
  image: string | null;
};

// Which slice of posts the feed shows: 'for-you' is the global discovery feed
// (own + friends first, then everyone else), 'friends' is own + friends only.
export type FeedScope = 'for-you' | 'friends';

// A single user suggestion shown while typing an @mention. Lightweight on
// purpose — just what the autocomplete row needs to render and to insert the
// handle, not the full UserProfile.
export type MentionSuggestion = {
  id: string;
  name: string;
  username: string;
  image: string | null;
};

// A single hashtag suggestion shown while typing "#" — the normalized tag and
// how many posts have already used it, so the autocomplete row can show its
// popularity.
export type HashtagSuggestion = {
  tag: string;
  count: number;
};

// The categories a user can independently tune for popups + sounds.
export type NotificationCategory =
  | 'friendRequest'
  | 'friendAccept'
  | 'directMessage'
  | 'roomMessage'
  | 'like'
  | 'mention';

export type NotificationPreferences = {
  // Master switch for playing any sound.
  soundEnabled: boolean;
  // 0..1 master volume applied to every sound.
  volume: number;
  // Per-category: show an in-app popup/toast, and play a sound.
  categories: Record<NotificationCategory, { popup: boolean; sound: boolean }>;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  soundEnabled: true,
  volume: 0.6,
  categories: {
    friendRequest: { popup: true, sound: true },
    friendAccept: { popup: true, sound: true },
    directMessage: { popup: true, sound: true },
    roomMessage: { popup: true, sound: true },
    like: { popup: true, sound: true },
    mention: { popup: true, sound: true },
  },
};
