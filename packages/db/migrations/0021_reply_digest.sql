ALTER TABLE "memberships" ADD COLUMN "digest_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN "digest_sent_at" timestamp with time zone;