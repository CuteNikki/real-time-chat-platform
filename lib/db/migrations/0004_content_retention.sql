-- 30-day content retention for moderation.
--
-- Deleting a post or a chat (and, since this migration, an individual message)
-- no longer hard-removes the row immediately. Instead we stamp a `deletedAt`
-- tombstone and keep the row viewable to moderators for 30 days so a report can
-- still be verified after the content is gone. A background purge (see
-- purgeExpiredContent) hard-removes rows once they age past the window.
--
--   * post.deletedAt            — soft-delete tombstone for a post. Hidden from
--                                 every normal reader; retained for moderation.
--   * chat.deletedAt            — soft-delete tombstone for a whole chat (set
--                                 when two people unfriend). Messages are kept
--                                 so a report filed in that chat stays reviewable.
--   * chat_participant.clearedAt — per-participant "clear chat" marker. Only
--                                 messages newer than this are shown to that
--                                 participant, so clearing a chat is now a
--                                 one-sided view reset rather than a destructive
--                                 delete that wiped the other person's history.
--
-- Pure additive changes (new nullable columns). Applied directly against the
-- database to match this project's drizzle `push` workflow (no migration journal).

ALTER TABLE "post"
  ADD COLUMN IF NOT EXISTS "deletedAt" timestamp;

ALTER TABLE "chat"
  ADD COLUMN IF NOT EXISTS "deletedAt" timestamp;

ALTER TABLE "chat_participant"
  ADD COLUMN IF NOT EXISTS "clearedAt" timestamp;
