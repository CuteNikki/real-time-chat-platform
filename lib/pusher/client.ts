"use client"

import PusherClient from "pusher-js"

let client: PusherClient | null = null

export function getPusherClient() {
  if (!client) {
    client = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      authEndpoint: "/api/pusher/auth",
    })
  }
  return client
}

// Mirror of lib/pusher/server.ts naming so the client subscribes correctly.
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
