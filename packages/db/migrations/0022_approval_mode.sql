ALTER TABLE "enrollments" ADD COLUMN "approved_step" integer;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "approve_sequence_emails" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "approve_reply_drafts" boolean DEFAULT true NOT NULL;--> statement-breakpoint
-- Workspaces from before this setting keep sequences sending on their own, as they did; new ones approve each email.
UPDATE "workspaces" SET "approve_sequence_emails" = false;