import { Send } from "lucide-react";
import Link from "next/link";
import { STAGES, type Stage } from "@meerko/sdk";
import { AddLead } from "@/components/app/add-lead";
import { CrmSyncButton } from "@/components/app/crm-sync-button";
import { DeleteTable } from "@/components/app/delete-table";
import { EnrichButton, PhoneButton } from "@/components/app/enrich-button";
import { LeadsTable, type LeadColumn } from "@/components/app/leads-table";
import { AgentHint, buttonClass, Card, CardHead, monoLabel, Page, PageHeader } from "@/components/app/ui";
import { load } from "@/lib/meerko";

const PAGE = 50;
// Shown inside the Name/Company/Email cells instead of as their own columns.
const MERGED = new Set(["first_name", "last_name", "title", "company", "domain", "email", "email_certainty", "email_verification"]);

export default async function TablePage({
  params,
  searchParams,
}: {
  params: Promise<{ tableId: string }>;
  searchParams: Promise<{ stage?: string; page?: string; sort?: string }>;
}) {
  const { tableId } = await params;
  const sp = await searchParams;
  const stage = STAGES.includes(sp.stage as Stage) ? (sp.stage as Stage) : undefined;
  const page = Math.max(1, Number(sp.page) || 1);

  const [table, rows, pipeline, crm] = await load((c) =>
    Promise.all([
      c.getTable(tableId),
      c.queryRows(tableId, { stage, limit: PAGE, offset: (page - 1) * PAGE }),
      c.pipeline(tableId),
      c.getCrm(),
    ]),
  );

  // "Best fit first" sorts this page by ICP score (scores are computed per page, from the workspace ICP).
  const byFit = sp.sort === "fit";
  if (byFit) rows.sort((a, b) => (b.icp?.score ?? -1) - (a.icp?.score ?? -1));
  const scored = rows.some((r) => r.icp?.score !== null && r.icp?.score !== undefined);
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
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const pageHref = (n: number) => `?${new URLSearchParams({ ...(stage ? { stage } : {}), ...(byFit ? { sort: "fit" } : {}), page: String(n) })}`;
  const sortHref = `?${new URLSearchParams({ ...(stage ? { stage } : {}), ...(byFit ? {} : { sort: "fit" }), page: String(page) })}`;
  const tab = (s: Stage | undefined, n: number) => (
    <Link
      key={s ?? "all"}
      href={s ? `?stage=${s}` : "?"}
      aria-current={stage === s ? "page" : undefined}
      className={`flex items-center gap-2 border-l border-lk-line px-3.5 py-[9px] font-plex text-[13px] tracking-[0.6px] uppercase first:border-l-0 ${
        stage === s ? "bg-lk-lime font-semibold text-lk-ink" : "text-lk-muted hover:text-lk-fg"
      }`}
    >
      {s ?? "All"} <span className={stage === s ? "text-lk-ink/70" : "text-lk-dim"}>{n}</span>
    </Link>
  );

  return (
    <Page>
      <PageHeader
        eyebrow="Leads / Table"
        title={table.name}
        meta={`${table.rowCount.toLocaleString("en")} rows · ${table.columns.length} columns`}
        actions={
          <>
            {(keys.has("first_name") || keys.has("email")) && <EnrichButton tableId={tableId} scored={scored} />}
            {(keys.has("first_name") || keys.has("linkedin_url")) && <PhoneButton tableId={tableId} />}
            {crm && keys.has("email") && <CrmSyncButton tableId={tableId} provider={crm.provider} />}
            <AddLead floating tableId={tableId} extraColumns={table.columns.filter((c) => !MERGED.has(c.key) && !c.prompt).map((c) => ({ key: c.key, name: c.name }))} />
            <Link href={`/app/sequences/new?table=${tableId}`} className={buttonClass("primary")}>
              <Send className="size-[15px]" /> New sequence
            </Link>
            <DeleteTable tableId={tableId} rowCount={table.rowCount} />
          </>
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Stage" className="flex max-w-full flex-wrap outline outline-1 -outline-offset-1 outline-lk-line">
          {tab(undefined, pipeline.total)}
          {STAGES.map((s) => tab(s, pipeline.stages[s]))}
        </nav>
        <span className="flex items-center gap-4">
          {scored && (
            <Link href={sortHref} className={`${monoLabel} hover:text-lk-lime ${byFit ? "!text-lk-lime" : ""}`}>
              {byFit ? "✓ Best fit first" : "Sort by fit"}
            </Link>
          )}
          <span className={monoLabel}>
          {total ? `Rows ${(page - 1) * PAGE + 1}–${Math.min(page * PAGE, total)} of ${total}` : "No rows"}
          </span>
        </span>
      </div>

      <Card>
        <CardHead title="Rows" />
        <LeadsTable tableId={tableId} columns={columns} rows={rows} />
      </Card>

      {aiPending.length > 0 && (
        <AgentHint command={`fill the ${aiPending[0]!.name} column`}>
          {aiPending.map((c) => `${c.n} ${c.name}`).join(", ")} {aiPending.length === 1 && aiPending[0]!.n === 1 ? "cell is" : "cells are"} waiting for your agent on this page.
        </AgentHint>
      )}
      {pages > 1 && (
        <div className="flex items-center justify-between gap-3 font-plex text-[13px] tracking-[0.6px] uppercase">
          {page > 1 ? <Link className="text-lk-muted hover:text-lk-lime" href={pageHref(page - 1)}>← Prev</Link> : <span className="text-lk-gray">← Prev</span>}
          <span className="text-lk-dim">Page {page} of {pages}</span>
          {page * PAGE < total ? <Link className="text-lk-muted hover:text-lk-lime" href={pageHref(page + 1)}>Next →</Link> : <span className="text-lk-gray">Next →</span>}
        </div>
      )}
    </Page>
  );
}
