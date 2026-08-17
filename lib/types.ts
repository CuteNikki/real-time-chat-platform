export type ChatType = "RANDOM" | "GROUP" | "PRIVATE"

export type ChatMessage = {
  id: string
  chatId: string
  senderId: string
  senderName: string
  content: string | null
  imageUrl: string | null
  createdAt: string
}

export type RoomSummary = {
  id: string
  name: string
  memberCount: number
  createdAt: string
}

export type InviteSummary = {
  id: string
  senderId: string
  senderName: string
  senderUsername: string
  senderImage: string | null
  receiverId: string
  status: "PENDING" | "ACCEPTED" | "DECLINED"
  chatId: string | null
  createdAt: string
}

export type OutgoingInviteSummary = {
  id: string
  receiverId: string
  receiverName: string
  receiverUsername: string
  receiverImage: string | null
  createdAt: string
}

export type FriendSummary = {
  id: string
  name: string
  username: string
  image: string | null
  // The private DM chat with this friend, if one exists.
  chatId: string | null
  interests: string[]
}

export type UserProfile = {
  id: string
  name: string
  username: string
  image: string | null
  bio: string | null
  interests: string[]
  role: "ADMIN" | "MODERATOR" | "MEMBER"
  postCount: number
  friendCount: number
  createdAt: string
  // Relationship of the viewer to this profile.
  isSelf: boolean
  friendStatus: "none" | "friends" | "incoming" | "outgoing"
  // If a DM chat already exists between viewer and this user.
  dmChatId: string | null
}

export type NotificationType = "FRIEND_REQUEST" | "FRIEND_ACCEPT" | "MESSAGE" | "LIKE"

export type NotificationSummary = {
  id: string
  type: NotificationType
  actorId: string | null
  actorName: string | null
  actorUsername: string | null // null only when the actor account is gone
  actorImage: string | null
  chatId: string | null
  body: string | null
  read: boolean
  createdAt: string
  // For FRIEND_REQUEST notifications: the still-pending invite id, so the
  // request can be accepted/declined inline. Null once handled or gone.
  inviteId: string | null
}

export type PostSummary = {
  id: string
  authorId: string
  authorName: string
  authorUsername: string
  authorImage: string | null
  imageUrl: string
  caption: string | null
  createdAt: string
  likeCount: number
  likedByMe: boolean
}

export type PostLiker = {
  id: string
  name: string
  username: string
  image: string | null
}

// The categories a user can independently tune for popups + sounds.
export type NotificationCategory =
  | "friendRequest"
  | "friendAccept"
  | "directMessage"
  | "roomMessage"
  | "like"

export type NotificationPreferences = {
  // Master switch for playing any sound.
  soundEnabled: boolean
  // 0..1 master volume applied to every sound.
  volume: number
  // Per-category: show an in-app popup/toast, and play a sound.
  categories: Record<NotificationCategory, { popup: boolean; sound: boolean }>
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  soundEnabled: true,
  volume: 0.6,
  categories: {
    friendRequest: { popup: true, sound: true },
    friendAccept: { popup: true, sound: true },
    directMessage: { popup: true, sound: true },
    roomMessage: { popup: true, sound: true },
    like: { popup: true, sound: true },
  },
}
