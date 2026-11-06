CREATE TABLE "email_sign_ins" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"source" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "google_sub" DROP NOT NULL;