ALTER TABLE "table_rows" ADD COLUMN "icp_adjust" integer;--> statement-breakpoint
ALTER TABLE "table_rows" ADD COLUMN "icp_note" text;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "icp" jsonb;