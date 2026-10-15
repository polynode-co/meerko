CREATE TABLE "agent_hooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"url" text NOT NULL,
	"encrypted_secret" text NOT NULL,
	"secret_last4" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_fired_at" timestamp with time zone,
	"last_status" integer,
	"last_error" text,
	"failing_since" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_hooks_workspace_id_unique" UNIQUE("workspace_id")
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "scope" text DEFAULT 'full' NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "agent_notified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "agent_hooks" ADD CONSTRAINT "agent_hooks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "messages_agent_pending_idx" ON "messages" USING btree ("workspace_id") WHERE "messages"."direction" = 'in' and "messages"."intent" is null and "messages"."agent_notified_at" is null;