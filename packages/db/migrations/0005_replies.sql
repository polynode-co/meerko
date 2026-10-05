ALTER TABLE "mailboxes" ADD COLUMN "replies_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "intent" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "handled_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "messages_mailbox_gmail_id_idx" ON "messages" USING btree ("mailbox_id","gmail_id");