import { Bot } from "lucide-react";
import { AgentHint, Card, EmptyState, Page, PageHeader } from "@/components/app/ui";
import { NewRoutine, RoutineCard } from "@/components/app/autopilot";
import { load } from "@/lib/meerko";

export default async function AutopilotPage() {
  const [routines, me] = await load((c) => Promise.all([c.listRoutines(), c.me()]));
  const hasReplies = routines.some((r) => r.when === "replies");
  return (
    <Page className="max-w-[1100px]">
      <PageHeader
        eyebrow="Autopilot"
        title="Your agent on autopilot"
        meta="Routines your own AI runs: when replies arrive, or on a schedule. Meerko starts each run, or checks that your AI's own schedule did, and shows how every run went."
        actions={<NewRoutine hasReplies={hasReplies} />}
      />
      {routines.length === 0 ? (
        <Card>
          <EmptyState icon={Bot} title="No routines yet">
            <span className="flex flex-col items-center gap-4">
              A routine is a brief your AI follows: answer new replies, or find and enrich ten leads every weekday morning. Create one with “New
              routine”.
              <AgentHint command="create a Meerko routine that drafts answers to my new replies">Your agent can set it up too.</AgentHint>
            </span>
          </EmptyState>
        </Card>
      ) : (
        <div className="flex flex-col gap-5">
          {routines.map((r) => (
            <RoutineCard key={r.id} routine={r} canSetTrigger={!!me.user} hasReplies={hasReplies} />
          ))}
        </div>
      )}
    </Page>
  );
}
