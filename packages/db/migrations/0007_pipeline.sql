ALTER TABLE "table_rows" ADD COLUMN "stage" text DEFAULT 'new' NOT NULL;--> statement-breakpoint
ALTER TABLE "table_rows" ADD COLUMN "stage_changed_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "table_rows_table_id_stage_idx" ON "table_rows" USING btree ("table_id","stage");