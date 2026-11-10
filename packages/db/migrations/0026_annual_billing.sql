-- Safe to re-run: dev databases may already have these from the branch's own migration before it was renumbered.
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "current_period_start" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "billing_interval" text;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "founding_offer_seen_at" timestamp with time zone;
