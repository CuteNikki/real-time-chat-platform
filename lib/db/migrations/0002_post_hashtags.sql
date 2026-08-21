-- Post hashtags: one row per (post, tag) for every #hashtag used in a caption.
--
-- `tag` is stored normalized (lowercased, sigil stripped, [a-z0-9_], <=50 chars
-- — see lib/mentions.ts normalizeHashtag) so per-tag post counts and tag search
-- compare directly. The set is rebuilt on caption create/edit and removed on
-- post delete (application-managed; no FK, matching this project's app tables).
--
--   * post_hashtag_post_tag_unique — one row per (post, tag); an edit re-inserts
--     with ON CONFLICT DO NOTHING after clearing the post's old rows.
--   * post_hashtag_tag_idx         — drives tag search + counting by tag.
--
-- Pure additive change (new table). Applied directly against the database to
-- match this project's drizzle `push` workflow (no migration journal).

CREATE TABLE IF NOT EXISTS "post_hashtag" (
  "id" text PRIMARY KEY NOT NULL,
  "postId" text NOT NULL,
  "tag" text NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "post_hashtag_post_tag_unique"
  ON "post_hashtag" ("postId", "tag");

CREATE INDEX IF NOT EXISTS "post_hashtag_tag_idx"
  ON "post_hashtag" ("tag");
