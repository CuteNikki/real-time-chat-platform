-- System messages + report review pipeline.
--
-- Two additive concerns:
--
--   1. SYSTEM messages. A `message` can now be an automated notice (a call
--      summary posted into a DM/random chat, or a moderation DM from the System
--      account) instead of a user message. `kind` defaults to 'USER' so every
--      existing row and every plain send keeps working untouched; `meta` holds
--      the structured payload (SystemMessageMeta — call outcome/duration, a
--      report reference, etc.) that the client renders into a centered notice.
--
--   2. Report lifecycle. A `report` gains a human-friendly `reference` (shared
--      with the reporter over a System DM), an optional `postId` target, and the
--      review fields a moderator sets on resolution (`status`, `verdict`,
--      `reviewedById`, `reviewedAt`). Existing rows default to 'PENDING'.
--
-- Pure additive changes (new nullable columns + defaults). Applied directly
-- against the database to match this project's drizzle `push` workflow (no
-- migration journal).

ALTER TABLE "message"
  ADD COLUMN IF NOT EXISTS "kind" text DEFAULT 'USER' NOT NULL;
ALTER TABLE "message"
  ADD COLUMN IF NOT EXISTS "meta" jsonb;

ALTER TABLE "report"
  ADD COLUMN IF NOT EXISTS "postId" text;
ALTER TABLE "report"
  ADD COLUMN IF NOT EXISTS "reference" text;
ALTER TABLE "report"
  ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'PENDING' NOT NULL;
ALTER TABLE "report"
  ADD COLUMN IF NOT EXISTS "verdict" text;
ALTER TABLE "report"
  ADD COLUMN IF NOT EXISTS "reviewedById" text;
ALTER TABLE "report"
  ADD COLUMN IF NOT EXISTS "reviewedAt" timestamp;
