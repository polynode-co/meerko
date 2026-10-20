import { Send } from "lucide-react";
import Link from "next/link";
import { STAGES, type Stage } from "@meerko/sdk";
import { AddLead } from "@/components/app/add-lead";
import { DeleteTable } from "@/components/app/delete-table";
import { EnrichButton } from "@/components/app/enrich-button";
import { LeadsTable, type LeadColumn } from "@/components/app/leads-table";
import { AgentHint, buttonClass, PageHeader } from "@/components/app/ui";
import { load } from "@/lib/meerko";

const PAGE = 50;
// Shown inside the Name/Company/Email cells instead of as their own columns.
const MERGED = new Set(["first_name", "last_name", "title", "company", "domain", "email", "email_certainty", "email_verification"]);

export default async function TablePage({
  params,
  searchParams,
}: {
  params: Promise<{ tableId: string }>;
  searchParams: Promise<{ stage?: string; page?: string }>;
}) {
  const { tableId } = await params;
  const sp = await searchParams;
  const stage = STAGES.includes(sp.stage as Stage) ? (sp.stage as Stage) : undefined;
  const page = Math.max(1, Number(sp.page) || 1);

  const [table, rows, pipeline] = await load((c) =>
    Promise.all([
      c.getTable(tableId),
      c.queryRows(tableId, { stage, limit: PAGE, offset: (page - 1) * PAGE }),
      c.pipeline(tableId),
    ]),
  );

  const keys = new Set(table.columns.map((c) => c.key));
  const columns: LeadColumn[] = [
    ...(keys.has("first_name") || keys.has("last_name") ? [{ key: "name", name: "Name", kind: "person" as const }] : []),
    ...(keys.has("company") ? [{ key: "company", name: "Company", kind: "company" as const }] : []),
    ...(keys.has("email") || keys.has("email_certainty") ? [{ key: "email", name: "Email", kind: "email" as const }] : []),
    ...table.columns
      .filter((c) => !MERGED.has(c.key))
      .map((c) => ({ key: c.key, name: c.name, kind: c.prompt ? ("ai" as const) : ("plain" as const), prompt: c.prompt })),
  ];
  const aiPending = columns
    .filter((c) => c.kind === "ai")
    .map((c) => ({ name: c.name, n: rows.filter((r) => r.data[c.key] === null || r.data[c.key] === undefined || r.data[c.key] === "").length }))
    .filter((c) => c.n > 0);
  const total = stage ? pipeline.stages[stage] : pipeline.total;
  const tab = (s: Stage | undefined, n: number) => (
    <Link
      key={s ?? "all"}
      href={s ? `?stage=${s}` : "?"}
      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium capitalize ${stage === s ? "bg-line text-fg" : "text-muted hover:text-fg"}`}
    >
      {s ?? "All"} <span className="font-mono text-[11px] text-muted">{n}</span>
    </Link>
  );

  return (
    <div className="flex flex-col gap-5 px-8 py-7">
      <PageHeader
        eyebrow="Leads / Table"
        title={table.name}
        meta={`${table.rowCount.toLocaleString("en")} rows · ${table.columns.length} columns`}
        actions={
          <>
            {(keys.has("first_name") || keys.has("email")) && <EnrichButton tableId={tableId} />}
            <AddLead floating tableId={tableId} extraColumns={table.columns.filter((c) => !MERGED.has(c.key) && !c.prompt).map((c) => ({ key: c.key, name: c.name }))} />
            <Link href={`/app/sequences/new?table=${tableId}`} className={buttonClass()}>
              <Send className="size-[15px]" /> New sequence
            </Link>
            <DeleteTable tableId={tableId} rowCount={table.rowCount} />
          </>
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-lg border border-line bg-raised p-[3px]">
          {tab(undefined, pipeline.total)}
          {STAGES.map((s) => tab(s, pipeline.stages[s]))}
        </div>
        <span className="font-mono text-xs text-muted">
          {total ? `Rows ${(page - 1) * PAGE + 1}–${Math.min(page * PAGE, total)} of ${total}` : "No rows"}
        </span>
      </div>

      <LeadsTable tableId={tableId} columns={columns} rows={rows} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        {aiPending.length ? (
          <AgentHint command={`fill the ${aiPending[0]!.name} column`}>
            {aiPending.map((c) => `${c.n} ${c.name}`).join(", ")} {aiPending.length === 1 && aiPending[0]!.n === 1 ? "cell is" : "cells are"} waiting for your agent on this page.
          </AgentHint>
        ) : (
          <span />
        )}
        <div className="flex gap-2 font-mono text-xs">
          {page > 1 && <Link className="text-accent hover:underline" href={`?${new URLSearchParams({ ...(stage ? { stage } : {}), page: String(page - 1) })}`}>← Prev</Link>}
          {page * PAGE < total && <Link className="text-accent hover:underline" href={`?${new URLSearchParams({ ...(stage ? { stage } : {}), page: String(page + 1) })}`}>Next →</Link>}
        </div>
      </div>
    </div>
  );
}
