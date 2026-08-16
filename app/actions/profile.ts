"use server"

import { db } from "@/lib/db"
import { user, post, invite } from "@/lib/db/schema"
import { getCurrentUser, getUserId } from "@/lib/session"
import type { UserProfile } from "@/lib/types"
import { and, eq, or, sql, ne } from "drizzle-orm"
import { revalidatePath } from "next/cache"

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/

function normalizeUsername(u: string) {
  return u.trim().toLowerCase()
}

// Count accepted friendships involving a user.
async function friendCount(userId: string) {
  const [row] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(invite)
    .where(
      and(
        eq(invite.status, "ACCEPTED"),
        or(eq(invite.senderId, userId), eq(invite.receiverId, userId)),
      ),
    )
  return row?.c ?? 0
}

// Resolve the relationship between the viewer and a target user.
async function relationship(viewerId: string, targetId: string) {
  if (viewerId === targetId) {
    return { friendStatus: "none" as const, dmChatId: null }
  }
  const rows = await db
    .select()
    .from(invite)
    .where(
      or(
        and(eq(invite.senderId, viewerId), eq(invite.receiverId, targetId)),
        and(eq(invite.senderId, targetId), eq(invite.receiverId, viewerId)),
      ),
    )
  let friendStatus: UserProfile["friendStatus"] = "none"
  let dmChatId: string | null = null
  for (const r of rows) {
    if (r.status === "ACCEPTED") {
      friendStatus = "friends"
      if (r.chatId) dmChatId = r.chatId
    } else if (r.status === "PENDING") {
      friendStatus = r.senderId === viewerId ? "outgoing" : "incoming"
    }
  }
  return { friendStatus, dmChatId }
}

export async function getProfileByUsername(
  username: string,
): Promise<UserProfile | null> {
  const viewer = await getCurrentUser()
  const uname = normalizeUsername(username)
  const [u] = await db
    .select()
    .from(user)
    .where(sql`lower(${user.username}) = ${uname}`)
    .limit(1)
  if (!u) return null

  const [{ c: postCount }] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(post)
    .where(eq(post.userId, u.id))

  const rel = await relationship(viewer.id, u.id)
  const fc = await friendCount(u.id)

  return {
    id: u.id,
    name: u.name,
    username: u.username,
    image: u.image,
    bio: u.bio,
    postCount,
    friendCount: fc,
    createdAt: u.createdAt.toISOString(),
    isSelf: u.id === viewer.id,
    friendStatus: rel.friendStatus,
    dmChatId: rel.dmChatId,
  }
}

export async function getMyProfile() {
  const me = await getCurrentUser()
  const [u] = await db.select().from(user).where(eq(user.id, me.id)).limit(1)
  return u
    ? {
        id: u.id,
        name: u.name,
        username: u.username,
        image: u.image,
        bio: u.bio,
      }
    : null
}

export async function isUsernameAvailable(username: string) {
  const uname = normalizeUsername(username)
  if (!USERNAME_RE.test(uname)) {
    return { available: false, reason: "invalid" as const }
  }
  const me = await getCurrentUser()
  const [existing] = await db
    .select({ id: user.id })
    .from(user)
    .where(
      and(sql`lower(${user.username}) = ${uname}`, ne(user.id, me.id)),
    )
    .limit(1)
  return { available: !existing, reason: existing ? ("taken" as const) : null }
}

export async function updateProfile(input: {
  name?: string
  username?: string
  bio?: string
  image?: string | null
}) {
  const userId = await getUserId()
  const updates: Record<string, unknown> = { updatedAt: new Date() }

  if (input.name !== undefined) {
    const n = input.name.trim()
    if (n.length < 1 || n.length > 50) throw new Error("Display name must be 1–50 characters")
    updates.name = n
  }

  if (input.username !== undefined) {
    const uname = normalizeUsername(input.username)
    if (!USERNAME_RE.test(uname)) {
      throw new Error("Username must be 3–20 characters: letters, numbers, underscores")
    }
    const [taken] = await db
      .select({ id: user.id })
      .from(user)
      .where(and(sql`lower(${user.username}) = ${uname}`, ne(user.id, userId)))
      .limit(1)
    if (taken) throw new Error("That username is taken")
    updates.username = uname
  }

  if (input.bio !== undefined) {
    const b = input.bio.trim()
    if (b.length > 300) throw new Error("Bio must be 300 characters or fewer")
    updates.bio = b || null
  }

  if (input.image !== undefined) {
    updates.image = input.image
  }

  await db.update(user).set(updates).where(eq(user.id, userId))
  revalidatePath("/app/settings")
  revalidatePath("/app")
  return { ok: true }
}

// Directory search by username or display name (for the "add friend" search).
export async function searchUsers(query: string) {
  const me = await getCurrentUser()
  const q = query.trim()
  if (q.length < 2) return []
  const like = `%${q.toLowerCase()}%`
  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      username: user.username,
      image: user.image,
    })
    .from(user)
    .where(
      and(
        ne(user.id, me.id),
        or(
          sql`lower(${user.username}) like ${like}`,
          sql`lower(${user.name}) like ${like}`,
        ),
      ),
    )
    .limit(10)

  // Annotate each result with the viewer's relationship so the UI can show the
  // right action (Add / Requested / Respond / Friends).
  const rels = await db
    .select({
      senderId: invite.senderId,
      receiverId: invite.receiverId,
      status: invite.status,
    })
    .from(invite)
    .where(or(eq(invite.senderId, me.id), eq(invite.receiverId, me.id)))

  function statusFor(otherId: string): "none" | "friends" | "incoming" | "outgoing" {
    for (const r of rels) {
      const involves =
        (r.senderId === me.id && r.receiverId === otherId) ||
        (r.senderId === otherId && r.receiverId === me.id)
      if (!involves) continue
      if (r.status === "ACCEPTED") return "friends"
      if (r.status === "PENDING") return r.senderId === me.id ? "outgoing" : "incoming"
    }
    return "none"
  }

  return rows.map((r) => ({ ...r, friendStatus: statusFor(r.id) }))
}
