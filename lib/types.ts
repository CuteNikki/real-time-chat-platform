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
  senderEmail: string
  receiverId: string
  status: "PENDING" | "ACCEPTED" | "DECLINED"
  chatId: string | null
  createdAt: string
}
