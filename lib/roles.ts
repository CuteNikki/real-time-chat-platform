import "server-only"
import { db } from "@/lib/db"
import { user } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { getCurrentUser } from "@/lib/session"

export type Role = "ADMIN" | "MODERATOR" | "MEMBER"

export const ROLES: Role[] = ["ADMIN", "MODERATOR", "MEMBER"]

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Admin",
  MODERATOR: "Moderator",
  MEMBER: "Member",
}

// Higher number = more privilege.
const RANK: Record<Role, number> = {
  MEMBER: 0,
  MODERATOR: 1,
  ADMIN: 2,
}

export function normalizeRole(value: string | null | undefined): Role {
  return value === "ADMIN" || value === "MODERATOR" ? value : "MEMBER"
}

export function atLeast(role: Role, minimum: Role): boolean {
  return RANK[role] >= RANK[minimum]
}

// Group chats can be created by moderators and admins.
export function canCreateGroups(role: Role): boolean {
  return atLeast(role, "MODERATOR")
}

// Only admins can manage roles.
export function canManageRoles(role: Role): boolean {
  return role === "ADMIN"
}

// Fetch the current user's role fresh from the DB (source of truth, since the
// session copy can be stale after a role change).
export async function getMyRole(): Promise<Role> {
  const me = await getCurrentUser()
  const [row] = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, me.id))
    .limit(1)
  return normalizeRole(row?.role)
}

// Server-side guard: throws unless the current user meets the minimum role.
export async function requireRole(minimum: Role): Promise<Role> {
  const role = await getMyRole()
  if (!atLeast(role, minimum)) {
    throw new Error("You do not have permission to do that")
  }
  return role
}
