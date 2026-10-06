import { Send } from "lucide-react";
import Link from "next/link";
import { AgentHint, Card, EmptyState, PageHeader, Pill } from "@/components/app/ui";
import { load } from "@/lib/meerko";

export default async function SequencesPage() {
  const sequences = await load((c) => c.listSequences());
  const stats = await load((c) => Promise.all(sequences.map((s) => c.sequenceStats(s.id))));
  return (
    <div className="flex flex-col gap-6 px-8 py-7">
      <PageHeader eyebrow="Sequences" title="Sequences" meta="Multi-step emails sent from your own mailbox, stopped automatically when someone replies." />
      <Card className="overflow-hidden">
        {stats.length === 0 ? (
          <EmptyState icon={Send} title="No sequences yet">
            <AgentHint command="write a 3-step sequence for my agencies table and show me a preview">Your agent writes sequences.</AgentHint>
          </EmptyState>
        ) : (
          stats.map((s) => (
            <Link key={s.id} href={`/app/sequences/${s.id}`} className="flex items-center gap-4 border-b border-line px-5 py-4 last:border-0 hover:bg-raised">
              <span className="flex-1 text-sm font-semibold">{s.name}</span>
              <Pill tone={s.status === "active" ? "signal" : s.status === "draft" ? "amber" : "neutral"}>{s.status === "active" ? "sending" : s.status}</Pill>
              <span className="w-24 text-right font-mono text-xs text-muted">{s.enrolled} enrolled</span>
              <span className="w-20 text-right font-mono text-xs text-muted">{s.emailsSent} sent</span>
              <span className={`w-24 text-right font-mono text-xs ${s.replyRate ? "text-signal" : "text-muted"}`}>{s.replyRate}% replied</span>
            </Link>
          ))
        )}
      </Card>
    </div>
  );
}
