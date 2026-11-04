import { DocsShell, docsMetadata } from "@/components/lookout/docs/shell";
import { AskAgent, C, H2, Tool } from "@/components/lookout/docs/ui";

export const metadata = docsMetadata("pipeline");

const stages: [stage: string, how: string, auto: boolean][] = [
  ["new", "Every lead starts here.", true],
  ["contacted", "When the first sequence email to them is sent.", true],
  ["replied", "When they reply.", true],
  ["meeting", "You or your agent, when a call is booked.", false],
  ["won", "You or your agent.", false],
  ["lost", "You or your agent.", false],
];

export default function Page() {
  return (
    <DocsShell
      slug="pipeline"
      lead={<p>Every lead has a stage. Meerko moves leads forward as emails go out and replies come in; you mark meetings, wins and losses.</p>}
      toc={[
        ["stages", "Stages"],
        ["rules", "How stages move"],
        ["summary", "Seeing the pipeline"],
      ]}
      tools={["pipeline", "move_stage", "query_rows"]}
    >
      <H2 id="stages">Stages</H2>
      <ol className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stages.map(([stage, how, auto], i) => (
          <li key={stage} className={`flex flex-col gap-1.5 rounded-xl border px-4 py-3.5 ${auto ? "border-line bg-raised" : "border-accent/35 bg-accent-soft"}`}>
            <span className="font-mono text-[12px]">{String(i + 1).padStart(2, "0")}</span>
            <span className="font-mono text-[15px] font-semibold text-fg">{stage}</span>
            <span className="text-[13px] leading-snug">{how}</span>
            <span className={`pt-1 font-mono text-[12px] tracking-[0.1em] uppercase ${auto ? "" : "text-accent"}`}>{auto ? "Automatic" : "You set it"}</span>
          </li>
        ))}
      </ol>

      <H2 id="rules">How stages move</H2>
      <ul className="flex list-disc flex-col gap-2 pl-6">
        <li>Automatic moves only go forward: a late reply never pulls a won lead back to replied, and a lost lead stays lost.</li>
        <li>
          <Tool name="move_stage" /> sets any stage, for up to 1,000 leads per call. In the dashboard, change it from the leads table; from
          the terminal, <C>pnpm meerko tables stage &lt;tableId&gt; &lt;stage&gt; &lt;rowIds...&gt;</C>.
        </li>
        <li>
          <Tool name="query_rows" /> with a <C>stage</C> lists the leads at that stage.
        </li>
      </ul>

      <H2 id="summary">Seeing the pipeline</H2>
      <p>
        <Tool name="pipeline" /> counts leads per stage, for one table or the whole workspace. The <C>/mcp__meerko__pipeline</C> command
        adds how each sequence is doing and what&apos;s waiting on you.
      </p>
      <AskAgent>/mcp__meerko__pipeline</AskAgent>
    </DocsShell>
  );
}
