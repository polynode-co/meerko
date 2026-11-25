import { Search, Table2 } from "lucide-react";
import Link from "next/link";
import { AddLead } from "@/components/app/add-lead";
import { ImportCsv } from "@/components/app/import-csv";
import { NewTable, TableRowActions } from "@/components/app/table-actions";
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

// On a phone only the name, the lead count and the actions fit; Columns and Created join from `sm`.
const cols =
  "grid grid-cols-[minmax(0,1fr)_64px_auto] sm:grid-cols-[minmax(220px,1fr)_90px_90px_110px_minmax(84px,auto)] items-center";
const wide = "hidden sm:block";

export default async function LeadsPage() {
  const tables = await load((c) => c.listTables());
  const leads = tables.reduce((n, t) => n + t.rowCount, 0);
  return (
    <Page>
      <PageHeader
        title="Leads"
        meta={`${tables.length} ${tables.length === 1 ? "table" : "tables"} · ${leads.toLocaleString("en")} ${leads === 1 ? "lead" : "leads"}`}
        actions={
          tables.length > 0 && (
            <>
              <NewTable />
              <ImportCsv />
            </>
          )
        }
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
                <NewTable />
              </span>
            </span>
          </EmptyState>
        ) : (
          <div>
            <div className={`${cols} border-b border-lk-line bg-ws-head`}>
              <span className={th}>Table</span>
              <span className={`${th} ${wide}`}>Columns</span>
              <span className={th}>Leads</span>
              <span className={`${th} ${wide}`}>Created</span>
              <span className={th}>
                <span className="sr-only">Actions</span>
              </span>
            </div>
            {tables.map((t) => (
              // The name's link covers the whole row (its ::after), and the actions sit above it.
              <div key={t.id} className={`${cols} relative min-h-14 border-b border-lk-line transition last:border-0 hover:bg-lk-frame`}>
                <span className="flex min-w-0 items-center gap-3 px-4">
                  <span className="grid size-7 shrink-0 place-items-center rounded-md bg-ws-soft">
                    <Table2 className="size-[14px] text-lk-muted" />
                  </span>
                  <Link href={`/app/leads/${t.id}`} className="truncate text-[13px] font-medium text-lk-fg after:absolute after:inset-0">
                    {t.name}
                  </Link>
                </span>
                <span className={`px-4 font-mono text-[12px] text-lk-muted ${wide}`}>{t.columns.length}</span>
                <span className="px-4 font-mono text-[12px] font-semibold text-lk-fg">{t.rowCount.toLocaleString("en")}</span>
                <span className={`px-4 font-mono text-[12px] text-lk-muted ${wide}`}>{formatWhen(t.createdAt)}</span>
                {/* On a phone, renaming or confirming a delete takes a line of its own under the name. */}
                <span className="relative z-10 px-3 py-2 max-sm:has-[form]:col-span-full max-sm:has-[[data-confirm]]:col-span-full">
                  <TableRowActions tableId={t.id} name={t.name} rowCount={t.rowCount} />
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </Page>
  );
}
