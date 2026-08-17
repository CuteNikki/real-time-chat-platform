import {
  pgTable,
  text,
  timestamp,
  boolean,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core"

// ---------------------------------------------------------------------------
// Better Auth tables (do not rename columns — they match Better Auth defaults)
// ---------------------------------------------------------------------------
export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("emailVerified").notNull().default(false),
    image: text("image"),
    // App profile fields.
    username: text("username").notNull(),
    bio: text("bio"),
    // Access role: "ADMIN" | "MODERATOR" | "MEMBER". Members are the default.
    role: text("role").notNull().default("MEMBER"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (t) => ({
    usernameUnique: uniqueIndex("user_username_unique").on(t.username),
  }),
)

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
})

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
})

// ---------------------------------------------------------------------------
// App tables
// ---------------------------------------------------------------------------

// chat.type: "RANDOM" | "GROUP" | "PRIVATE"
export const chat = pgTable("chat", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  name: text("name"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  endedAt: timestamp("endedAt"),
})

export const chatParticipant = pgTable(
  "chat_participant",
  {
    id: text("id").primaryKey(),
    chatId: text("chatId").notNull(),
    userId: text("userId").notNull(),
    joinedAt: timestamp("joinedAt").notNull().defaultNow(),
    leftAt: timestamp("leftAt"),
  },
  (t) => ({
    chatUserUnique: uniqueIndex("chat_participant_chat_user_unique").on(
      t.chatId,
      t.userId,
    ),
    chatLeftIdx: index("chat_participant_chat_left_idx").on(t.chatId, t.leftAt),
  }),
)

export const message = pgTable(
  "message",
  {
    id: text("id").primaryKey(),
    chatId: text("chatId").notNull(),
    senderId: text("senderId").notNull(),
    content: text("content"),
    imageUrl: text("imageUrl"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (t) => ({
    chatCreatedIdx: index("message_chat_created_idx").on(t.chatId, t.createdAt),
  }),
)

// invite.status: "PENDING" | "ACCEPTED" | "DECLINED"
export const invite = pgTable(
  "invite",
  {
    id: text("id").primaryKey(),
    senderId: text("senderId").notNull(),
    receiverId: text("receiverId").notNull(),
    status: text("status").notNull().default("PENDING"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    respondedAt: timestamp("respondedAt"),
    chatId: text("chatId"),
  },
  (t) => ({
    receiverStatusIdx: index("invite_receiver_status_idx").on(
      t.receiverId,
      t.status,
    ),
  }),
)

export const randomQueue = pgTable("random_queue", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull().unique(),
  joinedAt: timestamp("joinedAt").notNull().defaultNow(),
})

export const report = pgTable("report", {
  id: text("id").primaryKey(),
  reporterId: text("reporterId").notNull(),
  reportedUserId: text("reportedUserId").notNull(),
  chatId: text("chatId"),
  messageId: text("messageId"),
  reason: text("reason"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

// Profile posts (Instagram-style): an image with an optional caption.
export const post = pgTable(
  "post",
  {
    id: text("id").primaryKey(),
    userId: text("userId").notNull(),
    imageUrl: text("imageUrl").notNull(),
    caption: text("caption"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (t) => ({
    userCreatedIdx: index("post_user_created_idx").on(t.userId, t.createdAt),
  }),
)

export const postLike = pgTable(
  "post_like",
  {
    id: text("id").primaryKey(),
    postId: text("postId").notNull(),
    userId: text("userId").notNull(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (t) => ({
    postUserUnique: uniqueIndex("post_like_post_user_unique").on(
      t.postId,
      t.userId,
    ),
  }),
)

// Interest tags a user adds to their profile. `tag` is stored lowercased and
// slug-normalized so search/matching can compare directly.
export const interest = pgTable(
  "interest",
  {
    id: text("id").primaryKey(),
    userId: text("userId").notNull(),
    tag: text("tag").notNull(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (t) => ({
    userTagUnique: uniqueIndex("interest_user_tag_unique").on(t.userId, t.tag),
    tagIdx: index("interest_tag_idx").on(t.tag),
  }),
)

// A notification for a user: friend requests, accepts, and new messages.
// type: "FRIEND_REQUEST" | "FRIEND_ACCEPT" | "MESSAGE"
export const notification = pgTable(
  "notification",
  {
    id: text("id").primaryKey(),
    userId: text("userId").notNull(),
    type: text("type").notNull(),
    actorId: text("actorId"),
    chatId: text("chatId"),
    // Free-form context: sender name, message preview, etc.
    body: text("body"),
    readAt: timestamp("readAt"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (t) => ({
    userCreatedIdx: index("notification_user_created_idx").on(
      t.userId,
      t.createdAt,
    ),
    userReadIdx: index("notification_user_read_idx").on(t.userId, t.readAt),
  }),
)
