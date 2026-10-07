ALTER TABLE "sequence_mailboxes" DROP CONSTRAINT "sequence_mailboxes_mailbox_id_mailboxes_id_fk";
--> statement-breakpoint
ALTER TABLE "sequence_mailboxes" ADD CONSTRAINT "sequence_mailboxes_mailbox_id_mailboxes_id_fk" FOREIGN KEY ("mailbox_id") REFERENCES "public"."mailboxes"("id") ON DELETE cascade ON UPDATE no action;