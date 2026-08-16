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
  senderUsername: string | null
  senderImage: string | null
  receiverId: string
  status: "PENDING" | "ACCEPTED" | "DECLINED"
  chatId: string | null
  createdAt: string
}

export type UserProfile = {
  id: string
  name: string
  username: string | null
  image: string | null
  bio: string | null
  postCount: number
  friendCount: number
  createdAt: string
  // Relationship of the viewer to this profile.
  isSelf: boolean
  friendStatus: "none" | "friends" | "incoming" | "outgoing"
  // If a DM chat already exists between viewer and this user.
  dmChatId: string | null
}

export type PostSummary = {
  id: string
  authorId: string
  authorName: string
  authorUsername: string | null
  authorImage: string | null
  imageUrl: string
  caption: string | null
  createdAt: string
  likeCount: number
  likedByMe: boolean
}
