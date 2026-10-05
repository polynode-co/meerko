CREATE TABLE "credit_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"delta" integer NOT NULL,
	"reason" text NOT NULL,
	"ref_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enrichment_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"row_id" uuid NOT NULL,
	"field" text NOT NULL,
	"provider" text,
	"outcome" text NOT NULL,
	"result" jsonb,
	"provider_cost" numeric DEFAULT 0 NOT NULL,
	"cost_credits" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrichment_runs" ADD CONSTRAINT "enrichment_runs_row_id_table_rows_id_fk" FOREIGN KEY ("row_id") REFERENCES "public"."table_rows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "credit_ledger_workspace_id_idx" ON "credit_ledger" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "enrichment_runs_row_id_idx" ON "enrichment_runs" USING btree ("row_id");