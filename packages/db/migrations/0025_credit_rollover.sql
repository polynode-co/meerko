-- Safe to re-run: dev databases already had these from the branch's own 0021 before it was renumbered.
ALTER TABLE "credit_ledger" ADD COLUMN IF NOT EXISTS "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD COLUMN IF NOT EXISTS "remaining" integer;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_ledger_expiring_idx" ON "credit_ledger" USING btree ("expires_at") WHERE "credit_ledger"."remaining" > 0;
