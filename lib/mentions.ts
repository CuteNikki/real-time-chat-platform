// Parse a plain-text string (a post caption or a bio) into a sequence of text
// runs, @mention tokens, and #hashtag tokens.
//
//   * A mention is an "@" that starts a word, followed by 3–20 username
//     characters (letters, numbers, underscore) — matching the username rules
//     enforced in app/actions/profile.ts.
//   * A hashtag is a "#" that starts a word, followed by 1–50 tag characters
//     and containing at least one letter (so "#1" / "#100" stay plain text).
//
// A sigil sitting inside a larger token (e.g. an email like name@host, or a
// second "#" in "##tag") is left as plain text — only sigils on a word boundary
// begin a token.
export type RichTextToken =
  | { type: 'text'; value: string }
  | { type: 'mention'; username: string }
  | { type: 'hashtag'; tag: string };

// One pass matches every "@handle"/"#tag" run; per-sigil length/content rules
// are applied below so an invalid run falls through to plain text.
const TOKEN_RE = /([@#])([a-zA-Z0-9_]+)/g;

// A sigil only opens a token on a word boundary: at the start of the string, or
// after a character that is neither a word char nor a sigil. This keeps emails
// (name@host), "@@", and "##tag" from being tokenized.
function isBoundary(prev: string): boolean {
  return !prev || !/[\w@#]/.test(prev);
}

export function parseRichText(text: string): RichTextToken[] {
  const tokens: RichTextToken[] = [];
  let last = 0;

  for (const match of text.matchAll(TOKEN_RE)) {
    const start = match.index ?? 0;
    const prev = start > 0 ? text[start - 1] : '';
    if (!isBoundary(prev)) continue;

    const sigil = match[1];
    const body = match[2];
    let token: RichTextToken | null = null;
    if (sigil === '@') {
      // Usernames are 3–20 chars; anything longer isn't a valid handle.
      if (body.length >= 3 && body.length <= 20) {
        token = { type: 'mention', username: body };
      }
    } else if (body.length <= 50 && /[a-zA-Z]/.test(body)) {
      // Require a letter so pure-number runs (#1, #100) stay plain text.
      token = { type: 'hashtag', tag: body };
    }
    if (!token) continue;

    if (start > last) {
      tokens.push({ type: 'text', value: text.slice(last, start) });
    }
    tokens.push(token);
    last = start + match[0].length;
  }

  if (last < text.length) {
    tokens.push({ type: 'text', value: text.slice(last) });
  }
  return tokens;
}

// Canonical storage/URL form of a hashtag: lowercased, sigil stripped, reduced
// to [a-z0-9_], capped at 50 chars. Returns '' for anything without a letter,
// so it mirrors the parser and can be used to reject non-tags. Both the
// post_hashtag rows and the feed's ?tags= filter run through this, so counts
// and links always line up regardless of the casing a user typed.
export function normalizeHashtag(raw: string): string {
  const tag = raw
    .toLowerCase()
    .replace(/^#+/, '')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 50);
  return /[a-z]/.test(tag) ? tag : '';
}

// Distinct, normalized hashtags contained in a caption — the set persisted to
// post_hashtag for a post. De-duplicated so a caption repeating "#foo" counts
// once for that post.
export function extractHashtags(text: string | null | undefined): string[] {
  if (!text) return [];
  const set = new Set<string>();
  for (const token of parseRichText(text)) {
    if (token.type !== 'hashtag') continue;
    const tag = normalizeHashtag(token.tag);
    if (tag) set.add(tag);
  }
  return [...set];
}
