import { Bot } from "lucide-react";
import { AgentHint, Card, EmptyState, Page, PageHeader } from "@/components/app/ui";
import { NewRoutine, Routines } from "@/components/app/autopilot";
import { load } from "@/lib/meerko";

// "WS3 · Autopilot" (XDlOc) in docs/design/meerko.pen.

export default async function AutopilotPage() {
  const [routines, me] = await load((c) => Promise.all([c.listRoutines(), c.me()]));
  const hasReplies = routines.some((r) => r.when === "replies");
  const on = routines.filter((r) => r.status === "active");
  const next = on.filter((r) => r.nextDueAt).sort((a, b) => a.nextDueAt!.localeCompare(b.nextDueAt!))[0];
  const nextText =
    next &&
    new Date(next.nextDueAt!).toLocaleString("en-GB", {
      timeZone: next.cadence?.timezone ?? "UTC",
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }) + (next.cadence?.timezone ? "" : " UTC");

  return (
    <Page>
      <PageHeader
        title="Autopilot"
        meta={
          routines.length === 0
            ? "Routines your own AI runs: when replies arrive, or on a schedule."
            : [`${routines.length} ${routines.length === 1 ? "routine" : "routines"}`, `${on.length} on`, nextText && `next run ${nextText}`]
                .filter(Boolean)
                .join(" · ")
        }
        actions={<NewRoutine hasReplies={hasReplies} />}
      />
      {routines.length === 0 ? (
        <Card>
          <EmptyState icon={Bot} title="No routines yet">
            <span className="flex flex-col items-center gap-4">
              A brief your AI follows: answer new replies, or find ten leads every weekday morning.
              <AgentHint command="create a Meerko routine that drafts answers to my new replies">Your agent can set it up too.</AgentHint>
            </span>
          </EmptyState>
        </Card>
      ) : (
        <Routines routines={routines} canSetTrigger={!!me.user} hasReplies={hasReplies} />
      )}
    </Page>
  );
}
