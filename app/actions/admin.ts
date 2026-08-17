"use server"

import { and, desc, eq, ne, or, sql, count } from "drizzle-orm"
import { db } from "@/lib/db"
import { user } from "@/lib/db/schema"
import { getCurrentUser } from "@/lib/session"
import { normalizeRole, type Role } from "@/lib/roles"
import { requireRole } from "@/lib/roles-server"
import { revalidatePath } from "next/cache"

export type AdminUserRow = {
  id: string
  name: string
  username: string | null
  email: string
  image: string | null
  role: Role
  isSelf: boolean
}

// List users for the admin panel, optionally filtered by a search query.
export async function listUsersForAdmin(query = ""): Promise<AdminUserRow[]> {
  await requireRole("ADMIN")
  const me = await getCurrentUser()

  const q = query.trim().toLowerCase()
  const where = q
    ? or(
        sql`lower(${user.name}) like ${"%" + q + "%"}`,
        sql`lower(${user.username}) like ${"%" + q + "%"}`,
        sql`lower(${user.email}) like ${"%" + q + "%"}`,
      )
    : undefined

  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      image: user.image,
      role: user.role,
    })
    .from(user)
    .where(where)
    .orderBy(desc(user.createdAt))
    .limit(100)

  return rows.map((r) => ({
    ...r,
    role: normalizeRole(r.role),
    isSelf: r.id === me.id,
  }))
}

// Change a user's role. Admin-only. Prevents demoting the last remaining admin.
export async function setUserRole(targetUserId: string, role: Role) {
  await requireRole("ADMIN")
  const me = await getCurrentUser()

  if (!["ADMIN", "MODERATOR", "MEMBER"].includes(role)) {
    throw new Error("Invalid role")
  }

  const [target] = await db
    .select({ id: user.id, role: user.role })
    .from(user)
    .where(eq(user.id, targetUserId))
    .limit(1)
  if (!target) throw new Error("User not found")

  // Guard: don't allow removing the final admin (including self-demotion).
  if (normalizeRole(target.role) === "ADMIN" && role !== "ADMIN") {
    const [{ value: adminCount }] = await db
      .select({ value: count() })
      .from(user)
      .where(eq(user.role, "ADMIN"))
    if (Number(adminCount) <= 1) {
      throw new Error("There must be at least one admin")
    }
  }

  await db.update(user).set({ role }).where(eq(user.id, targetUserId))
  revalidatePath("/app/admin")
  return { ok: true, role, self: targetUserId === me.id }
}
