-- Safe to re-run (migrations run on deploy, and a renumbered branch may already have applied it).
CREATE TABLE IF NOT EXISTS "reviewer_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL CONSTRAINT "reviewer_links_user_id_users_id_fk" REFERENCES "public"."users"("id") ON DELETE cascade,
	"token_hash" text NOT NULL CONSTRAINT "reviewer_links_token_hash_unique" UNIQUE,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reviewer_link_uses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"link_id" uuid CONSTRAINT "reviewer_link_uses_link_id_reviewer_links_id_fk" REFERENCES "public"."reviewer_links"("id") ON DELETE cascade,
	"outcome" text NOT NULL,
	"ip" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reviewer_links_user_idx" ON "reviewer_links" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reviewer_link_uses_ip_idx" ON "reviewer_link_uses" USING btree ("ip","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reviewer_link_uses_created_idx" ON "reviewer_link_uses" USING btree ("created_at");
