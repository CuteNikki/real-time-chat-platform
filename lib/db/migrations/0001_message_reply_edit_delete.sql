-- Message replies + edit/delete support.
--
-- Adds three nullable columns to `message`:
--   * replyToId  — soft reference to the message this one replies to. No FK:
--                  the target may be soft-deleted but its row is kept so the
--                  quoted preview can still render ("deleted message").
--   * editedAt   — set when the sender edits; drives the "(edited)" marker.
--   * deletedAt  — soft-delete tombstone. On delete we also clear content and
--                  imageUrl in the row, but keep it so ordering and replies
--                  stay intact.
--
-- All columns are nullable with no default, so this is a pure additive change
-- with no backfill. Applied directly against the database to match this
-- project's drizzle `push` workflow (no migration journal).

ALTER TABLE "message" ADD COLUMN IF NOT EXISTS "replyToId" text;
ALTER TABLE "message" ADD COLUMN IF NOT EXISTS "editedAt" timestamp;
ALTER TABLE "message" ADD COLUMN IF NOT EXISTS "deletedAt" timestamp;
