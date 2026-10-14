import { Table2 } from "lucide-react";
import Link from "next/link";
import { ImportCsv } from "@/components/app/import-csv";
import { Card, EmptyState, PageHeader } from "@/components/app/ui";
import { load } from "@/lib/meerko";

export default async function LeadsPage() {
  const tables = await load((c) => c.listTables());
  return (
    <div className="flex flex-col gap-6 px-8 py-7">
      <PageHeader eyebrow="Leads" title="Tables" meta={`${tables.length} ${tables.length === 1 ? "table" : "tables"}`} actions={tables.length > 0 && <ImportCsv />} />
      <Card className="overflow-hidden">
        {tables.length === 0 ? (
          <EmptyState icon={Table2} title="No tables yet">
            <span className="flex flex-col items-center gap-3">
              Import a CSV of the people you want to email, or ask your agent to find leads (“find 50 fintech CTOs in Spain”).
              <ImportCsv variant="primary" />
            </span>
          </EmptyState>
        ) : (
          tables.map((t) => (
            <Link key={t.id} href={`/app/leads/${t.id}`} className="flex items-center gap-4 border-b border-line px-5 py-4 last:border-0 hover:bg-raised">
              <Table2 className="size-4 text-accent" />
              <span className="flex-1 text-sm font-semibold">{t.name}</span>
              <span className="font-mono text-xs text-muted">{t.columns.length} columns</span>
              <span className="w-24 text-right font-mono text-xs text-muted">{t.rowCount.toLocaleString("en")} rows</span>
            </Link>
          ))
        )}
      </Card>
    </div>
  );
}
