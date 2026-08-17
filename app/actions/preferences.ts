'use server';

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { user } from '@/lib/db/schema';
import { getUserId } from '@/lib/session';
import { normalizePreferences, parsePrefs } from '@/lib/notification-prefs';
import type { NotificationPreferences } from '@/lib/types';

export async function getMyNotificationPreferences(): Promise<NotificationPreferences> {
  const userId = await getUserId();
  const [row] = await db
    .select({ prefs: user.notificationPrefs })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  return parsePrefs(row?.prefs ?? null);
}

// Preferences for an arbitrary user, used server-side when deciding whether to
// notify a recipient (e.g. the author of a liked post).
export async function getNotificationPreferencesFor(
  targetUserId: string,
): Promise<NotificationPreferences> {
  const [row] = await db
    .select({ prefs: user.notificationPrefs })
    .from(user)
    .where(eq(user.id, targetUserId))
    .limit(1);
  return parsePrefs(row?.prefs ?? null);
}

export async function updateNotificationPreferences(
  prefs: NotificationPreferences,
): Promise<NotificationPreferences> {
  const userId = await getUserId();
  const clean = normalizePreferences(prefs);
  await db
    .update(user)
    .set({ notificationPrefs: JSON.stringify(clean) })
    .where(eq(user.id, userId));
  return clean;
}
