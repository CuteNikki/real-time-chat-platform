import {
  pgTable,
  text,
  timestamp,
  boolean,
  jsonb,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

import type { NotificationMetadata, SystemMessageMeta } from '@/lib/types';

// ---------------------------------------------------------------------------
// Better Auth tables (do not rename columns — they match Better Auth defaults)
// ---------------------------------------------------------------------------
export const user = pgTable(
  'user',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    emailVerified: boolean('emailVerified').notNull().default(false),
    image: text('image'),
    // App profile fields.
    username: text('username').notNull(),
    bio: text('bio'),
    // Access role: "ADMIN" | "MODERATOR" | "MEMBER". Members are the default.
    role: text('role').notNull().default('MEMBER'),
    // JSON-serialized NotificationPreferences. Null = use app defaults.
    notificationPrefs: text('notificationPrefs'),
    // Privacy: when true, only accepted friends (and the owner) can see this
    // user's posts. Off by default, so posts stay publicly viewable.
    friendsOnlyPosts: boolean('friendsOnlyPosts').notNull().default(false),
    // Denormalized current ban status for fast per-request gating. Full history
    // lives in the `ban` table. `banExpiresAt` null while banned = permanent.
    isBanned: boolean('isBanned').notNull().default(false),
    banExpiresAt: timestamp('banExpiresAt'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (t) => ({
    usernameUnique: uniqueIndex('user_username_unique').on(t.username),
  }),
);

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expiresAt').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
});

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: timestamp('accessTokenExpiresAt'),
  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
});

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt').notNull(),
  createdAt: timestamp('createdAt').defaultNow(),
  updatedAt: timestamp('updatedAt').defaultNow(),
});

// ---------------------------------------------------------------------------
// App tables
// ---------------------------------------------------------------------------

// chat.type: "RANDOM" | "GROUP" | "PRIVATE"
export const chat = pgTable('chat', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  name: text('name'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  endedAt: timestamp('endedAt'),
  // Soft-delete tombstone for a whole chat (set when two people unfriend).
  // Messages are retained so a report filed in this chat stays reviewable for
  // 30 days; a background purge hard-removes everything past the window.
  deletedAt: timestamp('deletedAt'),
});

export const chatParticipant = pgTable(
  'chat_participant',
  {
    id: text('id').primaryKey(),
    chatId: text('chatId').notNull(),
    userId: text('userId').notNull(),
    joinedAt: timestamp('joinedAt').notNull().defaultNow(),
    leftAt: timestamp('leftAt'),
    // Per-participant "clear chat" marker: only messages newer than this are
    // shown to this participant. Lets one person clear their own view without
    // destroying the other person's history (or the moderation record).
    clearedAt: timestamp('clearedAt'),
  },
  (t) => ({
    chatUserUnique: uniqueIndex('chat_participant_chat_user_unique').on(
      t.chatId,
      t.userId,
    ),
    chatLeftIdx: index('chat_participant_chat_left_idx').on(t.chatId, t.leftAt),
  }),
);

export const message = pgTable(
  'message',
  {
    id: text('id').primaryKey(),
    chatId: text('chatId').notNull(),
    senderId: text('senderId').notNull(),
    // 'USER' for normal messages; 'SYSTEM' for automated notices (call
    // summaries, moderation DMs). Defaults to USER so existing rows and plain
    // sends need no change.
    kind: text('kind').notNull().default('USER'),
    // Structured payload for a SYSTEM message (see SystemMessageMeta); null for
    // USER messages. Rendered into a centered notice on the client.
    meta: jsonb('meta').$type<SystemMessageMeta>(),
    content: text('content'),
    imageUrl: text('imageUrl'),
    // The message this one is a reply to, if any. Soft reference (no FK): the
    // target may be soft-deleted but the row is kept so the quote can still
    // render "deleted message".
    replyToId: text('replyToId'),
    // Set when the sender edits the message; drives the "(edited)" marker.
    editedAt: timestamp('editedAt'),
    // Soft-delete tombstone. When set, content/imageUrl are cleared in the DB
    // but the row is kept so message ordering and replies stay intact.
    deletedAt: timestamp('deletedAt'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (t) => ({
    chatCreatedIdx: index('message_chat_created_idx').on(t.chatId, t.createdAt),
  }),
);

// invite.status: "PENDING" | "ACCEPTED" | "DECLINED"
export const invite = pgTable(
  'invite',
  {
    id: text('id').primaryKey(),
    senderId: text('senderId').notNull(),
    receiverId: text('receiverId').notNull(),
    status: text('status').notNull().default('PENDING'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    respondedAt: timestamp('respondedAt'),
    chatId: text('chatId'),
  },
  (t) => ({
    receiverStatusIdx: index('invite_receiver_status_idx').on(
      t.receiverId,
      t.status,
    ),
  }),
);

export const randomQueue = pgTable('random_queue', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull().unique(),
  joinedAt: timestamp('joinedAt').notNull().defaultNow(),
});

export const report = pgTable('report', {
  id: text('id').primaryKey(),
  reporterId: text('reporterId').notNull(),
  reportedUserId: text('reportedUserId').notNull(),
  chatId: text('chatId'),
  messageId: text('messageId'),
  // The post being reported, if the report targets a post rather than a user
  // or a chat message.
  postId: text('postId'),
  reason: text('reason'),
  // A short, human-friendly reference code (e.g. "ORB-7F3K") shared with the
  // reporter over a System DM so they can be told the outcome later.
  reference: text('reference'),
  // Review lifecycle: "PENDING" until a moderator resolves it, then "RESOLVED".
  status: text('status').notNull().default('PENDING'),
  // The moderator's ruling, set at resolution: "GUILTY" | "NOT_GUILTY".
  verdict: text('verdict'),
  reviewedById: text('reviewedById'),
  reviewedAt: timestamp('reviewedAt'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
});

// Profile posts (Instagram-style): an image with an optional caption.
export const post = pgTable(
  'post',
  {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    // Nullable: posts can be text-only (no image).
    imageUrl: text('imageUrl'),
    caption: text('caption'),
    // Soft-delete tombstone. Hidden from every normal reader but retained for
    // 30 days so a report against it can still be verified after removal; a
    // background purge hard-deletes the row (and its likes/hashtags) past then.
    deletedAt: timestamp('deletedAt'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (t) => ({
    userCreatedIdx: index('post_user_created_idx').on(t.userId, t.createdAt),
  }),
);

export const postLike = pgTable(
  'post_like',
  {
    id: text('id').primaryKey(),
    postId: text('postId').notNull(),
    userId: text('userId').notNull(),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (t) => ({
    postUserUnique: uniqueIndex('post_like_post_user_unique').on(
      t.postId,
      t.userId,
    ),
  }),
);

// Hashtags used in a post's caption: one row per (post, tag). `tag` is stored
// lowercased/normalized (see normalizeHashtag) so tag search and per-tag post
// counts compare directly. The set is rebuilt whenever a caption is created or
// edited, and dropped when the post is deleted. Mirrors the `interest` table's
// shape.
export const postHashtag = pgTable(
  'post_hashtag',
  {
    id: text('id').primaryKey(),
    postId: text('postId').notNull(),
    tag: text('tag').notNull(),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (t) => ({
    postTagUnique: uniqueIndex('post_hashtag_post_tag_unique').on(
      t.postId,
      t.tag,
    ),
    tagIdx: index('post_hashtag_tag_idx').on(t.tag),
  }),
);

// Interest tags a user adds to their profile. `tag` is stored lowercased and
// slug-normalized so search/matching can compare directly.
export const interest = pgTable(
  'interest',
  {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    tag: text('tag').notNull(),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (t) => ({
    userTagUnique: uniqueIndex('interest_user_tag_unique').on(t.userId, t.tag),
    tagIdx: index('interest_tag_idx').on(t.tag),
  }),
);

// A ban record — one row per ban action, kept forever for history. The active
// ban (if any) is the row with liftedAt IS NULL for a user. Denormalized status
// is mirrored onto user.isBanned / user.banExpiresAt for fast gating.
export const ban = pgTable(
  'ban',
  {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    // Who issued the ban (admin/moderator user id).
    bannedById: text('bannedById').notNull(),
    reason: text('reason').notNull(),
    // null expiresAt = permanent ban.
    expiresAt: timestamp('expiresAt'),
    // IP captured/banned at ban time, if the moderator chose an IP ban.
    ipAddress: text('ipAddress'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    // Set when the ban is lifted (manually or superseded). null = still active.
    liftedAt: timestamp('liftedAt'),
    liftedById: text('liftedById'),
    // Free-form note on why it was lifted / superseded.
    liftReason: text('liftReason'),
  },
  (t) => ({
    userCreatedIdx: index('ban_user_created_idx').on(t.userId, t.createdAt),
    userActiveIdx: index('ban_user_active_idx').on(t.userId, t.liftedAt),
  }),
);

// A banned IP address. Any session/request whose IP matches is blocked.
export const bannedIp = pgTable(
  'banned_ip',
  {
    id: text('id').primaryKey(),
    ipAddress: text('ipAddress').notNull(),
    reason: text('reason').notNull(),
    bannedById: text('bannedById').notNull(),
    // The account this IP ban originated from, if any.
    userId: text('userId'),
    // null = permanent.
    expiresAt: timestamp('expiresAt'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    liftedAt: timestamp('liftedAt'),
    liftedById: text('liftedById'),
    liftReason: text('liftReason'),
  },
  (t) => ({
    ipActiveIdx: index('banned_ip_active_idx').on(t.ipAddress, t.liftedAt),
  }),
);

// A notification for a user: friend requests, accepts, likes, and new messages.
//
// Rows store STRUCTURED, atomic data — never a pre-rendered display string.
// The actor's name/avatar are joined live from `user` at read time, and any
// extra context (message preview, room name) lives in `metadata`. Presentation
// is composed on the client from these fields, so a name is never duplicated.
//
// type: "FRIEND_REQUEST" | "FRIEND_ACCEPT" | "MESSAGE" | "LIKE"
export const notification = pgTable(
  'notification',
  {
    id: text('id').primaryKey(),
    // The user who receives this notification.
    recipientId: text('recipientId').notNull(),
    // The user whose action triggered it (sender / liker / requester).
    actorId: text('actorId').notNull(),
    type: text('type').notNull(),
    // The entity the notification is about, used both for deep-linking and for
    // deduplication: chatId for MESSAGE / FRIEND_ACCEPT, postId for LIKE, and
    // the actorId for FRIEND_REQUEST. Non-null so the dedupe index treats every
    // (recipient, actor, type, target) tuple as exactly one notification.
    targetId: text('targetId').notNull(),
    // Raw, structured payload for rendering (e.g. { preview, roomName,
    // chatType }). Never a formatted sentence.
    metadata: jsonb('metadata').$type<NotificationMetadata>(),
    readAt: timestamp('readAt'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (t) => ({
    // Robust deduplication: one row per (recipient, actor, type, target).
    // Re-emitting the same event UPSERTs the existing row (see notify()),
    // so a single event can never create duplicate notifications.
    dedupeUnique: uniqueIndex('notification_dedupe_unique').on(
      t.recipientId,
      t.actorId,
      t.type,
      t.targetId,
    ),
    recipientCreatedIdx: index('notification_recipient_created_idx').on(
      t.recipientId,
      t.createdAt,
    ),
    recipientReadIdx: index('notification_recipient_read_idx').on(
      t.recipientId,
      t.readAt,
    ),
  }),
);
