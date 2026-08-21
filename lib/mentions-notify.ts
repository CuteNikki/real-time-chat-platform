import 'server-only';

import { and, eq, inArray, ne, sql } from 'drizzle-orm';

import { notify } from '@/app/actions/notifications';
import { db } from '@/lib/db';
import { user } from '@/lib/db/schema';
import { parseRichText } from '@/lib/mentions';

// Cap how many people a single post/bio can notify, so a caption stuffed with
// @handles can't fan out into unbounded work or notification spam.
const MAX_MENTION_NOTIFICATIONS = 10;
// Short context snippet stored on the notification (caption/bio excerpt).
const PREVIEW_LENGTH = 140;

// Distinct, lowercased usernames mentioned in a piece of text. Stored usernames
// are always lowercased, so lowercasing the parsed handles makes the match
// case-insensitive.
function mentionedUsernames(text: string | null | undefined): Set<string> {
  const set = new Set<string>();
  if (!text) return set;
  for (const token of parseRichText(text)) {
    if (token.type === 'mention') set.add(token.username.toLowerCase());
  }
  return set;
}

// Notify every user newly @mentioned in a post caption or profile bio.
//
// - `source` picks the sentence ("tagged you in their post" vs "…their
//   profile") and the deep-link the client builds.
// - `targetId` is the post id for a post mention, or the actor's own id for a
//   profile mention (so the notification points back at the actor's profile).
// - On edits, pass `previousText` so only *newly added* mentions fire — editing
//   a caption that already tagged someone won't re-notify them.
//
// Best-effort: never throws into the caller, so a post/profile save still
// succeeds even if notifying fails.
export async function notifyMentions(input: {
  actorId: string;
  source: 'post' | 'profile';
  targetId: string;
  text: string | null | undefined;
  previousText?: string | null;
}) {
  try {
    const current = mentionedUsernames(input.text);
    if (current.size === 0) return;

    // Only notify handles that weren't already mentioned before an edit.
    const previous = mentionedUsernames(input.previousText);
    const fresh = [...current].filter((u) => !previous.has(u));
    if (fresh.length === 0) return;

    const usernames = fresh.slice(0, MAX_MENTION_NOTIFICATIONS);

    // Resolve handles → user rows, excluding the actor (no self-notifications).
    const recipients = await db
      .select({ id: user.id })
      .from(user)
      .where(
        and(
          inArray(sql`lower(${user.username})`, usernames),
          ne(user.id, input.actorId),
        ),
      );
    if (recipients.length === 0) return;

    // Actor display fields ride along on the realtime toast (avatar + name).
    const [actor] = await db
      .select({ name: user.name, username: user.username, image: user.image })
      .from(user)
      .where(eq(user.id, input.actorId))
      .limit(1);

    const preview = input.text?.trim().slice(0, PREVIEW_LENGTH) || undefined;

    for (const r of recipients) {
      await notify({
        recipientId: r.id,
        actorId: input.actorId,
        type: 'MENTION',
        targetId: input.targetId,
        category: 'mention',
        metadata: { mentionSource: input.source, preview },
        actor: {
          name: actor?.name ?? 'Someone',
          username: actor?.username ?? null,
          image: actor?.image ?? null,
        },
      });
    }
  } catch (err) {
    console.log(
      '[v0] notifyMentions failed:',
      err instanceof Error ? err.message : err,
    );
  }
}
