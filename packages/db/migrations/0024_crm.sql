-- Safe to re-run: dev databases already had these from the branch's own 0021 before it was renumbered.
CREATE TABLE IF NOT EXISTS "crm_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"encrypted_token" text NOT NULL,
	"last4" text NOT NULL,
	"account_name" text,
	"auto_sync" boolean DEFAULT true NOT NULL,
	"last_synced_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "crm_connections_workspace_id_unique" UNIQUE("workspace_id")
);
--> statement-breakpoint
ALTER TABLE "table_rows" ADD COLUMN IF NOT EXISTS "crm_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "table_rows" ADD COLUMN IF NOT EXISTS "crm_record_id" text;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_connections_workspace_id_workspaces_id_fk') THEN
    ALTER TABLE "crm_connections" ADD CONSTRAINT "crm_connections_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
