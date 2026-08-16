import Pusher from "pusher"

// Single server-side Pusher instance. Exported as both `pusher` (used by
// server actions) and `pusherServer` (used by the pusher auth route).
export const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS: true,
})

export const pusherServer = pusher
