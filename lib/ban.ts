import 'server-only';
import { db } from '@/lib/db';
import { ban, bannedIp, user } from '@/lib/db/schema';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { headers } from 'next/headers';

export type BanInfo = {
  id: string;
  scope: 'ACCOUNT' | 'IP';
  reason: string;
  bannedByName: string | null;
  createdAt: string;
  // null = permanent.
  expiresAt: string | null;
  ipAddress: string | null;
};

// Best-effort client IP from proxy headers. In the v0 preview / behind proxies
// this can be a shared or empty value — callers must tolerate null.
export async function getRequestIp(): Promise<string | null> {
  const h = await headers();
  const fwd = h.get('x-forwarded-for');
  if (fwd) {
    // First entry is the originating client.
    const first = fwd.split(',')[0]?.trim();
    if (first) return first;
  }
  return h.get('x-real-ip')?.trim() || null;
}

function isExpired(expiresAt: Date | null): boolean {
  return expiresAt != null && expiresAt.getTime() <= Date.now();
}

// The current active account ban for a user, or null. Auto-lifts (and clears the
// denormalized user flags) when a temporary ban has expired.
export async function getActiveUserBan(
  userId: string,
): Promise<BanInfo | null> {
  const [row] = await db
    .select({
      id: ban.id,
      reason: ban.reason,
      expiresAt: ban.expiresAt,
      ipAddress: ban.ipAddress,
      createdAt: ban.createdAt,
      bannedByName: user.name,
    })
    .from(ban)
    .leftJoin(user, eq(user.id, ban.bannedById))
    .where(and(eq(ban.userId, userId), isNull(ban.liftedAt)))
    .orderBy(desc(ban.createdAt))
    .limit(1);

  if (!row) {
    // Make sure the denormalized flag isn't stuck on.
    await db
      .update(user)
      .set({ isBanned: false, banExpiresAt: null })
      .where(eq(user.id, userId));
    return null;
  }

  if (isExpired(row.expiresAt)) {
    await db
      .update(ban)
      .set({ liftedAt: new Date(), liftReason: 'Ban expired' })
      .where(eq(ban.id, row.id));
    await db
      .update(user)
      .set({ isBanned: false, banExpiresAt: null })
      .where(eq(user.id, userId));
    return null;
  }

  return {
    id: row.id,
    scope: 'ACCOUNT',
    reason: row.reason,
    bannedByName: row.bannedByName ?? null,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    ipAddress: row.ipAddress ?? null,
  };
}

// The current active IP ban matching an address, or null. Auto-lifts expired.
export async function getActiveIpBan(
  ip: string | null,
): Promise<BanInfo | null> {
  if (!ip) return null;
  const [row] = await db
    .select({
      id: bannedIp.id,
      reason: bannedIp.reason,
      expiresAt: bannedIp.expiresAt,
      ipAddress: bannedIp.ipAddress,
      createdAt: bannedIp.createdAt,
      bannedByName: user.name,
    })
    .from(bannedIp)
    .leftJoin(user, eq(user.id, bannedIp.bannedById))
    .where(and(eq(bannedIp.ipAddress, ip), isNull(bannedIp.liftedAt)))
    .orderBy(desc(bannedIp.createdAt))
    .limit(1);

  if (!row) return null;

  if (isExpired(row.expiresAt)) {
    await db
      .update(bannedIp)
      .set({ liftedAt: new Date() })
      .where(eq(bannedIp.id, row.id));
    return null;
  }

  return {
    id: row.id,
    scope: 'IP',
    reason: row.reason,
    bannedByName: row.bannedByName ?? null,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    ipAddress: row.ipAddress ?? null,
  };
}

// The effective ban blocking the current request, if any. Account bans take
// priority over IP bans. `userId` may be null for signed-out requests.
export async function getEffectiveBan(
  userId: string | null,
): Promise<BanInfo | null> {
  if (userId) {
    const accountBan = await getActiveUserBan(userId);
    if (accountBan) return accountBan;
  }
  const ip = await getRequestIp();
  return getActiveIpBan(ip);
}
