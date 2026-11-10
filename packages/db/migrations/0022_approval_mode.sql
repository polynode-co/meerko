-- Safe to re-run: dev databases already had these from the branch's own 0021 before it was renumbered.
ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "approved_step" integer;--> statement-breakpoint
-- Workspaces from before this setting keep sequences sending on their own, as they did; new ones approve each email.
-- The data step only runs when the columns are first added, so a re-run never resets someone's choice.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'workspaces' AND column_name = 'approve_sequence_emails') THEN
    ALTER TABLE "workspaces" ADD COLUMN "approve_sequence_emails" boolean DEFAULT true NOT NULL;
    UPDATE "workspaces" SET "approve_sequence_emails" = false;
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "approve_reply_drafts" boolean DEFAULT true NOT NULL;
