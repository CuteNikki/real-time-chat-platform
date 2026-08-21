import 'server-only';

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { user } from '@/lib/db/schema';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '@/lib/types';
import type {
  NotificationCategory,
  NotificationPreferences,
} from '@/lib/types';

const CATEGORIES: NotificationCategory[] = [
  'friendRequest',
  'friendAccept',
  'directMessage',
  'roomMessage',
  'like',
  'mention',
];

// Merge a stored (possibly partial / older) preferences blob with defaults so
// new categories always have a value and bad data can't crash the UI.
export function normalizePreferences(raw: unknown): NotificationPreferences {
  const d = DEFAULT_NOTIFICATION_PREFERENCES;
  if (!raw || typeof raw !== 'object') return structuredClone(d);
  const p = raw as Partial<NotificationPreferences>;
  const storedCategories = (p.categories ?? {}) as Record<
    string,
    { popup?: boolean; sound?: boolean }
  >;
  // Back-compat: the old single "message" category split into directMessage +
  // roomMessage. Fall back to the legacy value so existing users keep intent.
  const legacyMessage = storedCategories.message;
  const categories = {} as NotificationPreferences['categories'];
  for (const c of CATEGORIES) {
    const stored =
      storedCategories[c] ??
      (c === 'directMessage' || c === 'roomMessage'
        ? legacyMessage
        : undefined);
    categories[c] = {
      popup:
        typeof stored?.popup === 'boolean'
          ? stored.popup
          : d.categories[c].popup,
      sound:
        typeof stored?.sound === 'boolean'
          ? stored.sound
          : d.categories[c].sound,
    };
  }
  return {
    soundEnabled:
      typeof p.soundEnabled === 'boolean' ? p.soundEnabled : d.soundEnabled,
    volume:
      typeof p.volume === 'number'
        ? Math.min(1, Math.max(0, p.volume))
        : d.volume,
    categories,
  };
}

export function parsePrefs(stored: string | null): NotificationPreferences {
  if (!stored) return structuredClone(DEFAULT_NOTIFICATION_PREFERENCES);
  try {
    return normalizePreferences(JSON.parse(stored));
  } catch {
    return structuredClone(DEFAULT_NOTIFICATION_PREFERENCES);
  }
}

// Read a specific user's stored preferences (server-side; used to decide whether
// to create a notification for that recipient).
export async function getUserPreferences(
  userId: string,
): Promise<NotificationPreferences> {
  const [row] = await db
    .select({ prefs: user.notificationPrefs })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  return parsePrefs(row?.prefs ?? null);
}
