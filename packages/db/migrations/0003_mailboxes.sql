CREATE TABLE "mailboxes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"email" text NOT NULL,
	"display_name" text,
	"encrypted_refresh_token" text NOT NULL,
	"daily_limit" integer DEFAULT 50 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mailboxes" ADD CONSTRAINT "mailboxes_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mailboxes_workspace_email_idx" ON "mailboxes" USING btree ("workspace_id","email");