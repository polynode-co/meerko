ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "thread_lookups" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Sent mail still without its ids a day after it went out was looked up on every reply tick since, or never can be
-- found, like the reviewer demo's mail, which was never sent: it counts as looked up as often as the tick ever will
-- (MAX_THREAD_LOOKUPS in packages/core/src/replies/replies.ts).
UPDATE "messages" SET "thread_lookups" = 10
WHERE "direction" = 'out' AND "gmail_thread_id" IS NULL AND "thread_lookups" < 10 AND "sent_at" < now() - interval '1 day';