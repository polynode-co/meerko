CREATE TABLE "crm_connections" (
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
ALTER TABLE "table_rows" ADD COLUMN "crm_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "table_rows" ADD COLUMN "crm_record_id" text;--> statement-breakpoint
ALTER TABLE "crm_connections" ADD CONSTRAINT "crm_connections_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;