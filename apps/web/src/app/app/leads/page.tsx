import { Search, Table2 } from "lucide-react";
import Link from "next/link";
import { AddLead } from "@/components/app/add-lead";
import { ImportCsv } from "@/components/app/import-csv";
import { buttonClass, Card, CardHead, EmptyState, formatWhen, Page, PageHeader, th } from "@/components/app/ui";
import { load } from "@/lib/meerko";

// "LK · App Leads" (zD4as) in the .pen file.

const findButton = (variant: "primary" | "secondary") => (
  <Link href="/app/leads/find" className={buttonClass(variant)}>
    <Search className="size-[15px]" />
    Find leads
  </Link>
);

const cols = "grid grid-cols-[minmax(200px,1fr)_120px_120px_120px] items-center";

export default async function LeadsPage() {
  const tables = await load((c) => c.listTables());
  return (
    <Page>
      <PageHeader
        eyebrow="Leads"
        title="Tables"
        meta={`${tables.length} ${tables.length === 1 ? "table" : "tables"}`}
        actions={
          <>
            {tables.length > 0 && <ImportCsv />}
            {tables.length > 0 && findButton("primary")}
          </>
        }
      />
      <Card>
        <CardHead title="All tables" />
        {tables.length === 0 ? (
          <EmptyState icon={Table2} title="No tables yet">
            <span className="flex flex-col items-center gap-4">
              Find leads in the database, import a CSV of the people you want to email, add them one by one, or ask your agent (“find
              50 fintech CTOs in Spain”).
              <span className="flex flex-wrap items-start justify-center gap-3">
                {findButton("primary")}
                <ImportCsv />
                <AddLead />
              </span>
            </span>
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[600px]">
              <div className={`${cols} border-b border-lk-line bg-lk-ink`}>
                <span className={th}>Name</span>
                <span className={th}>Columns</span>
                <span className={th}>Rows</span>
                <span className={th}>Created</span>
              </div>
              {tables.map((t) => (
                <Link key={t.id} href={`/app/leads/${t.id}`} className={`${cols} border-b border-lk-line py-3 text-[15px] transition last:border-0 hover:bg-lk-frame`}>
                  <span className="truncate px-[18px] text-lk-fg">{t.name}</span>
                  <span className="px-[18px] text-lk-muted">{t.columns.length}</span>
                  <span className="px-[18px] text-lk-muted">{t.rowCount.toLocaleString("en")}</span>
                  <span className="px-[18px] text-lk-muted">{formatWhen(t.createdAt)}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </Card>
    </Page>
  );
}
