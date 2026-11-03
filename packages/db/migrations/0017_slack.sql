CREATE TABLE "slack_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"encrypted_secret" text NOT NULL,
	"team_id" text,
	"team_name" text,
	"channel_id" text,
	"channel_name" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_posted_at" timestamp with time zone,
	"last_error" text,
	"failing_since" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "slack_connections_workspace_id_unique" UNIQUE("workspace_id")
);
--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "slack_notified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "reply_drafts" ADD COLUMN "slack_channel" text;--> statement-breakpoint
ALTER TABLE "reply_drafts" ADD COLUMN "slack_ts" text;--> statement-breakpoint
ALTER TABLE "reply_drafts" ADD COLUMN "slack_notified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "slack_connections" ADD CONSTRAINT "slack_connections_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "slack_connections_team_idx" ON "slack_connections" USING btree ("team_id");