ALTER TABLE "mailboxes" ADD COLUMN IF NOT EXISTS "disconnect_reported_at" timestamp with time zone;--> statement-breakpoint
-- Mailboxes already disconnected before this column existed count as told: only new disconnects send the email.
UPDATE "mailboxes" SET "disconnect_reported_at" = now() WHERE "status" = 'error' AND "disconnect_reported_at" IS NULL;
