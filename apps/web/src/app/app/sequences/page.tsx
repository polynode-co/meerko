import { Plus, Send } from "lucide-react";
import Link from "next/link";
import { AgentHint, buttonClass, Card, EmptyState, Page, PageHeader, Pill, th, type PillTone } from "@/components/app/ui";
import { load } from "@/lib/meerko";

// "WS3 · Sequences" (nXqOI) in the .pen file.

const cols = "grid grid-cols-[minmax(200px,1fr)_120px_100px_90px_90px_minmax(150px,190px)] items-center";
const statusTone: Record<string, PillTone> = { active: "signal", paused: "amber", draft: "neutral" };

export default async function SequencesPage() {
  const sequences = await load((c) => c.listSequences());
  const stats = await load((c) => Promise.all(sequences.map((s) => c.sequenceStats(s.id))));
  const count = (status: string) => stats.filter((s) => s.status === status).length;
  const meta = [
    `${stats.length} ${stats.length === 1 ? "sequence" : "sequences"}`,
    count("active") && `${count("active")} sending`,
    count("paused") && `${count("paused")} paused`,
    count("draft") && `${count("draft")} ${count("draft") === 1 ? "draft" : "drafts"}`,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Page>
      <PageHeader
        title="Sequences"
        meta={meta}
        actions={
          <Link href="/app/sequences/new" className={buttonClass("primary")}>
            <Plus /> New sequence
          </Link>
        }
      />
      <Card>
        {stats.length === 0 ? (
          <EmptyState icon={Send} title="No sequences yet">
            <span className="flex flex-col items-center gap-4">
              Write one with “New sequence”, or let your agent draft it.
              <AgentHint command="write a 3-step sequence for my agencies table and show me a preview">Your agent can write it too.</AgentHint>
            </span>
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[720px]">
              <div className={`${cols} border-b border-lk-line bg-ws-head`}>
                <span className={th}>Name</span>
                <span className={th}>Status</span>
                <span className={th}>Enrolled</span>
                <span className={th}>Sent</span>
                <span className={th}>Replied</span>
                <span className={th}>Reply rate</span>
              </div>
              {stats.map((s) => (
                <Link
                  key={s.id}
                  href={`/app/sequences/${s.id}`}
                  className={`${cols} min-h-14 border-b border-lk-line py-2.5 text-[13px] transition last:border-0 hover:bg-lk-frame`}
                >
                  <span className="truncate px-4 font-medium text-lk-fg">{s.name}</span>
                  <span className="px-4">
                    <Pill tone={statusTone[s.status] ?? "neutral"}>{s.status === "active" ? "sending" : s.status}</Pill>
                  </span>
                  <span className="px-4 font-mono text-[12px] text-lk-fg">{s.enrolled.toLocaleString("en")}</span>
                  <span className="px-4 font-mono text-[12px] text-lk-fg">{s.emailsSent.toLocaleString("en")}</span>
                  <span className="px-4 font-mono text-[12px] text-lk-fg">{(s.states.replied ?? 0).toLocaleString("en")}</span>
                  <span className="flex items-center gap-3 px-4">
                    <span className={`w-11 font-mono text-[12px] ${s.replyRate ? "font-semibold text-lk-fg" : "text-lk-dim"}`}>{s.replyRate}%</span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-ws-soft">
                      <span className="block h-full rounded-full bg-lk-fg" style={{ width: `${Math.min(100, s.replyRate * 6)}%` }} />
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </Card>
    </Page>
  );
}
