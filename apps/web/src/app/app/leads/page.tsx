import { Search, Table2 } from "lucide-react";
import Link from "next/link";
import { AddLead } from "@/components/app/add-lead";
import { ImportCsv } from "@/components/app/import-csv";
import { buttonClass, Card, EmptyState, formatWhen, Page, PageHeader, th } from "@/components/app/ui";
import { load } from "@/lib/meerko";

// "WS · Leads" (o1pVfK) in docs/design/meerko.pen. The per-table pipeline bar in the design is left out: the list
// doesn't load stage counts per table.

const findButton = (variant: "primary" | "secondary") => (
  <Link href="/app/leads/find" className={buttonClass(variant)}>
    <Search />
    Find leads
  </Link>
);

const cols = "grid grid-cols-[minmax(220px,1fr)_110px_110px_110px] items-center";

export default async function LeadsPage() {
  const tables = await load((c) => c.listTables());
  const leads = tables.reduce((n, t) => n + t.rowCount, 0);
  return (
    <Page>
      <PageHeader
        title="Leads"
        meta={`${tables.length} ${tables.length === 1 ? "table" : "tables"} · ${leads.toLocaleString("en")} ${leads === 1 ? "lead" : "leads"}`}
        actions={tables.length > 0 && <ImportCsv />}
      />
      <Card>
        {tables.length === 0 ? (
          <EmptyState icon={Table2} title="No tables yet">
            <span className="flex flex-col items-center gap-4">
              Find leads, import a CSV, add them one by one, or ask your agent (“find 50 fintech CTOs in Spain”).
              <span className="flex flex-wrap items-start justify-center gap-2">
                {findButton("primary")}
                <ImportCsv />
                <AddLead />
              </span>
            </span>
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[600px]">
              <div className={`${cols} border-b border-lk-line bg-ws-head`}>
                <span className={th}>Table</span>
                <span className={th}>Columns</span>
                <span className={th}>Leads</span>
                <span className={th}>Created</span>
              </div>
              {tables.map((t) => (
                <Link key={t.id} href={`/app/leads/${t.id}`} className={`${cols} min-h-14 border-b border-lk-line transition last:border-0 hover:bg-lk-frame`}>
                  <span className="flex min-w-0 items-center gap-3 px-4">
                    <span className="grid size-7 shrink-0 place-items-center rounded-md bg-ws-soft">
                      <Table2 className="size-[14px] text-lk-muted" />
                    </span>
                    <span className="truncate text-[13px] font-medium text-lk-fg">{t.name}</span>
                  </span>
                  <span className="px-4 font-mono text-[12px] text-lk-muted">{t.columns.length}</span>
                  <span className="px-4 font-mono text-[12px] font-semibold text-lk-fg">{t.rowCount.toLocaleString("en")}</span>
                  <span className="px-4 font-mono text-[12px] text-lk-muted">{formatWhen(t.createdAt)}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </Card>
    </Page>
  );
}
