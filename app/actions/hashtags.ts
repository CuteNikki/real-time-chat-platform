'use server';

import { sql } from 'drizzle-orm';

import { db } from '@/lib/db';
import { postHashtag } from '@/lib/db/schema';
import { getUserId } from '@/lib/session';
import type { HashtagSuggestion } from '@/lib/types';

// Suggest existing hashtags as the user types "#", ranked by how many posts
// have used each (most-used first, then alphabetical for stability). Prefix
// match — "trav" surfaces "#travel", "#travelgram" — mirroring the intuition
// that a hashtag is completed from its start, not matched mid-word.
//
// Only tags that already exist are returned: a brand-new tag has no count to
// show yet, and the user can still type it in full.
export async function searchHashtags(
  query: string,
): Promise<HashtagSuggestion[]> {
  await getUserId();

  // Clean the partial the same way stored tags are, but WITHOUT the "must
  // contain a letter" rule, so a still-being-typed prefix like "5k" can match.
  const q = query
    .toLowerCase()
    .replace(/^#+/, '')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 50);
  if (!q) return [];

  const like = `${q}%`;
  const rows = await db
    .select({ tag: postHashtag.tag, count: sql<number>`count(*)::int` })
    .from(postHashtag)
    .where(sql`${postHashtag.tag} like ${like}`)
    .groupBy(postHashtag.tag)
    .orderBy(sql`count(*) desc`, postHashtag.tag)
    .limit(6);

  return rows;
}
