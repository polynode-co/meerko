import { Plus, Send } from "lucide-react";
import Link from "next/link";
import { AgentHint, buttonClass, Card, CardHead, EmptyState, Page, PageHeader, Pill, th } from "@/components/app/ui";
import { load } from "@/lib/meerko";

// "LK · App Sequences" (g6PP2) in the .pen file.

const cols = "grid grid-cols-[minmax(200px,1fr)_130px_100px_90px_90px_110px] items-center";

export default async function SequencesPage() {
  const sequences = await load((c) => c.listSequences());
  const stats = await load((c) => Promise.all(sequences.map((s) => c.sequenceStats(s.id))));
  return (
    <Page>
      <PageHeader
        eyebrow="Sequences"
        title="Sequences"
        meta="Multi-step emails sent from your own mailbox, stopped automatically when someone replies."
        actions={
          <Link href="/app/sequences/new" className={buttonClass("primary")}>
            <Plus className="size-[15px]" /> New sequence
          </Link>
        }
      />
      <Card>
        <CardHead title="All sequences" />
        {stats.length === 0 ? (
          <EmptyState icon={Send} title="No sequences yet">
            <span className="flex flex-col items-center gap-4">
              Write one here with “New sequence”, or let your agent draft it for you.
              <AgentHint command="write a 3-step sequence for my agencies table and show me a preview">Your agent can write it too.</AgentHint>
            </span>
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[720px]">
              <div className={`${cols} border-b border-lk-line bg-lk-ink`}>
                <span className={th}>Name</span>
                <span className={th}>Status</span>
                <span className={th}>Enrolled</span>
                <span className={th}>Sent</span>
                <span className={th}>Replied</span>
                <span className={th}>Reply rate</span>
              </div>
              {stats.map((s) => (
                <Link key={s.id} href={`/app/sequences/${s.id}`} className={`${cols} border-b border-lk-line py-3 text-[15px] transition last:border-0 hover:bg-lk-frame`}>
                  <span className="truncate px-[18px] text-lk-fg">{s.name}</span>
                  <span className="px-[18px]">
                    <Pill tone={s.status === "active" ? "solid" : "neutral"}>{s.status === "active" ? "sending" : s.status}</Pill>
                  </span>
                  <span className="px-[18px] text-lk-muted">{s.enrolled}</span>
                  <span className="px-[18px] text-lk-muted">{s.emailsSent}</span>
                  <span className="px-[18px] text-lk-muted">{s.states.replied ?? 0}</span>
                  <span className={`px-[18px] ${s.replyRate ? "text-lk-lime" : "text-lk-muted"}`}>{s.replyRate}%</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </Card>
    </Page>
  );
}
