ALTER TABLE "credit_ledger" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD COLUMN "remaining" integer;--> statement-breakpoint
CREATE INDEX "credit_ledger_expiring_idx" ON "credit_ledger" USING btree ("expires_at") WHERE "credit_ledger"."remaining" > 0;