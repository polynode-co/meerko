CREATE TABLE IF NOT EXISTS "mailbox_rejections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mailbox_id" uuid NOT NULL,
	"error" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mailboxes" ADD COLUMN IF NOT EXISTS "held_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "mailboxes" ADD COLUMN IF NOT EXISTS "hold_reason" text;--> statement-breakpoint
ALTER TABLE "mailboxes" ADD COLUMN IF NOT EXISTS "hold_detail" text;--> statement-breakpoint
ALTER TABLE "mailboxes" ADD COLUMN IF NOT EXISTS "hold_notified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "mailboxes" ADD COLUMN IF NOT EXISTS "hold_counts_from" timestamp with time zone;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mailbox_rejections_mailbox_id_mailboxes_id_fk') THEN
    ALTER TABLE "mailbox_rejections" ADD CONSTRAINT "mailbox_rejections_mailbox_id_mailboxes_id_fk" FOREIGN KEY ("mailbox_id") REFERENCES "public"."mailboxes"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mailbox_rejections_mailbox_idx" ON "mailbox_rejections" USING btree ("mailbox_id","created_at");
