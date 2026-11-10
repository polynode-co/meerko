ALTER TABLE "workspaces" ADD COLUMN "current_period_start" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "billing_interval" text;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "founding_offer_seen_at" timestamp with time zone;