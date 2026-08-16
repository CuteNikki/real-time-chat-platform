import Pusher from "pusher"

export const pusherServer = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS: true,
})

// Channel + event naming helpers keep client/server in sync.
export const channels = {
  chat: (chatId: string) => `chat-${chatId}`,
  user: (userId: string) => `user-${userId}`,
  presence: (chatId: string) => `presence-chat-${chatId}`,
}

export const events = {
  newMessage: "new-message",
  chatEnded: "chat-ended",
  participantsChanged: "participants-changed",
  matchFound: "match-found",
  inviteReceived: "invite-received",
  inviteAccepted: "invite-accepted",
} as const
