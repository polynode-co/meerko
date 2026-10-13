ALTER TABLE "credit_ledger" ADD COLUMN "external_ref" text;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "plan" text DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "stripe_subscription_id" text;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "subscription_status" text;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "current_period_end" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "cancel_at_period_end" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_external_ref_unique" UNIQUE("external_ref");--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_stripe_customer_id_unique" UNIQUE("stripe_customer_id");