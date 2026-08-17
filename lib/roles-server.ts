import "server-only"
import { db } from "@/lib/db"
import { user } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { getCurrentUser } from "@/lib/session"
import { type Role, normalizeRole, atLeast } from "@/lib/roles"

// Fetch the current user's role fresh from the DB (source of truth, since the
// session copy can be stale after a role change).
export async function getMyRole(): Promise<Role> {
  const me = await getCurrentUser()
  const [row] = await db.select({ role: user.role }).from(user).where(eq(user.id, me.id)).limit(1)
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
