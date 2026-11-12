import { Coins } from "lucide-react";
import Link from "next/link";
import { FindLeads } from "@/components/app/find-leads";
import { AgentHint, Page, PageHeader } from "@/components/app/ui";
import { load } from "@/lib/meerko";

// "WS · Find leads" (Cr4ix) in docs/design/meerko.pen.

export default async function FindLeadsPage() {
  const [tables, credits] = await load((c) => Promise.all([c.listTables(), c.getCredits()]));
  return (
    <Page>
      <PageHeader
        eyebrow={
          <>
            <Link href="/app/leads" className="hover:text-lk-fg">
              Leads
            </Link>{" "}
            /
          </>
        }
        title="Find leads"
        meta={credits.enabled ? "Counting is free · 1 credit per lead added" : "Counting is free"}
        actions={
          credits.enabled && (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-lk-line bg-white px-2.5 py-[5px] font-mono text-[12px] text-lk-fg">
              <Coins className="size-[13px] text-lk-muted" />
              {(credits.balance ?? 0).toLocaleString("en")}
              <span className="text-[11px] text-lk-dim">credits</span>
            </span>
          )
        }
      />
      <FindLeads tables={tables.map((t) => ({ id: t.id, name: t.name }))} credits={credits.enabled ? credits.balance : null}>
        <AgentHint command="find 50 fintech CTOs in Spain">Or ask your agent.</AgentHint>
      </FindLeads>
    </Page>
  );
}
