CREATE TABLE "sequence_mailboxes" (
	"sequence_id" uuid NOT NULL,
	"mailbox_id" uuid NOT NULL,
	CONSTRAINT "sequence_mailboxes_sequence_id_mailbox_id_pk" PRIMARY KEY("sequence_id","mailbox_id")
);
--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "mailbox_id" uuid;--> statement-breakpoint
ALTER TABLE "mailboxes" ADD COLUMN "ramp_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sequences" ADD COLUMN "assignment" text DEFAULT 'capacity' NOT NULL;--> statement-breakpoint
ALTER TABLE "sequence_mailboxes" ADD CONSTRAINT "sequence_mailboxes_sequence_id_sequences_id_fk" FOREIGN KEY ("sequence_id") REFERENCES "public"."sequences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequence_mailboxes" ADD CONSTRAINT "sequence_mailboxes_mailbox_id_mailboxes_id_fk" FOREIGN KEY ("mailbox_id") REFERENCES "public"."mailboxes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sequence_mailboxes_mailbox_idx" ON "sequence_mailboxes" USING btree ("mailbox_id");--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_mailbox_id_mailboxes_id_fk" FOREIGN KEY ("mailbox_id") REFERENCES "public"."mailboxes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Backfill: every existing sequence's single mailbox becomes its pool, and its leads stay on it.
INSERT INTO "sequence_mailboxes" ("sequence_id", "mailbox_id") SELECT "id", "mailbox_id" FROM "sequences";--> statement-breakpoint
UPDATE "enrollments" SET "mailbox_id" = "sequences"."mailbox_id" FROM "sequences" WHERE "enrollments"."sequence_id" = "sequences"."id";
