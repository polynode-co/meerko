-- Safe to re-run (migrations run on deploy, and a renumbered branch may already have applied it).
CREATE TABLE IF NOT EXISTS "mcp_event_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL CONSTRAINT "mcp_event_subscriptions_user_id_users_id_fk" REFERENCES "public"."users"("id") ON DELETE cascade,
	"workspace_id" uuid NOT NULL CONSTRAINT "mcp_event_subscriptions_workspace_id_workspaces_id_fk" REFERENCES "public"."workspaces"("id") ON DELETE cascade,
	"routine_id" uuid NOT NULL CONSTRAINT "mcp_event_subscriptions_routine_id_routines_id_fk" REFERENCES "public"."routines"("id") ON DELETE cascade,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"encrypted_secret" text NOT NULL,
	"refresh_before" timestamp with time zone NOT NULL,
	"last_delivery_at" timestamp with time zone,
	"last_status" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mcp_event_subscriptions_routine_idx" ON "mcp_event_subscriptions" USING btree ("routine_id");
