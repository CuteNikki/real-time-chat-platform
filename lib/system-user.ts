import 'server-only';

import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { user } from '@/lib/db/schema';

// The built-in "System" account. It authors automated DMs — report receipts,
// review outcomes, and moderation notices ("your post was removed"). A fixed id
// so every environment shares one canonical System user and code can reference
// it without a lookup.
export const SYSTEM_USER_ID = 'user_system';
export const SYSTEM_USERNAME = 'system';
export const SYSTEM_NAME = 'System';
// Stable, non-deliverable address that satisfies the unique/not-null email
// column. It never receives mail; the account can't be signed into (no
// `account` row / password).
export const SYSTEM_EMAIL = 'system@orbit.local';

// Whether a user id is the System account. Used to hide it from people-facing
// surfaces (moderation lists, search) where an automated account shouldn't
// appear.
export function isSystemUser(userId: string | null | undefined): boolean {
  return userId === SYSTEM_USER_ID;
}

// Lazily ensure the System user row exists. Seeding can't ride along with the
// drizzle `push` workflow (which only syncs schema, never inserts data), so the
// row is created on first use and left alone thereafter. Idempotent via
// onConflictDoNothing, so concurrent callers race harmlessly.
export async function ensureSystemUser(): Promise<void> {
  const [existing] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.id, SYSTEM_USER_ID))
    .limit(1);
  if (existing) return;

  await db
    .insert(user)
    .values({
      id: SYSTEM_USER_ID,
      name: SYSTEM_NAME,
      email: SYSTEM_EMAIL,
      emailVerified: true,
      username: SYSTEM_USERNAME,
      role: 'MEMBER',
    })
    .onConflictDoNothing();
}
