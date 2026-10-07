ALTER TABLE "sequences" DROP CONSTRAINT "sequences_mailbox_id_mailboxes_id_fk";
--> statement-breakpoint
ALTER TABLE "sequences" DROP COLUMN "mailbox_id";