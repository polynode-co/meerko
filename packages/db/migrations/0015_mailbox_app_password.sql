ALTER TABLE "mailboxes" ALTER COLUMN "encrypted_refresh_token" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "mailboxes" ADD COLUMN "login" text;--> statement-breakpoint
ALTER TABLE "mailboxes" ADD COLUMN "encrypted_password" text;--> statement-breakpoint
ALTER TABLE "mailboxes" ADD CONSTRAINT "mailboxes_one_credential" CHECK (("mailboxes"."encrypted_refresh_token" is null) <> ("mailboxes"."encrypted_password" is null));