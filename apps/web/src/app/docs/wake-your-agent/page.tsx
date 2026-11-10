import { BellRing, CalendarClock, ShieldCheck } from "lucide-react";
import { CodeBlock } from "@/components/lookout/docs/code-block";
import { DocsShell, docsMetadata } from "@/components/lookout/docs/shell";
import { C, Callout, Cards, Fields, H2, L, Step, Tool } from "@/components/lookout/docs/ui";
import { publicApiUrl } from "@/lib/meerko";

export const metadata = docsMetadata("wake-your-agent", "Autopilot: wake your AI agent on replies or a schedule | Meerko docs");

const code = (title: string, text: string, wrap = false) => <CodeBlock title={title} code={text} wrap={wrap} lines={text.split("\n").map((t) => ({ text: t }))} />;

const payload = `{
  "id": "evt_5f0c…",
  "type": "replies.waiting",
  "created_at": "2026-10-16T07:02:00.000Z",
  "reason": "replies",
  "workspace": { "id": "8c1e…", "name": "Acme outbound" },
  "routine": { "id": "6a2d…", "name": "Answer new replies", "brief": "Classify each new reply…", "when": "replies" },
  "replies": [
    {
      "id": "3d9a…",
      "from": "pia@slalom.example",
      "subject": "Re: Quick question, Pia",
      "received_at": "2026-10-16T06:58:41.000Z",
      "sequence_id": "b71f…"
    }
  ],
  "inbox_url": "https://meerko.ai/app/inbox",
  "autopilot_url": "https://meerko.ai/app/autopilot"
}`;

const sdkRecipe = (drafterUrl: string) => `import { createHmac, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { query } from "@anthropic-ai/claude-agent-sdk";

const SECRET = process.env.MEERKO_WEBHOOK_SECRET!; // whsec_… from Autopilot
const KEY = process.env.MEERKO_DRAFTS_KEY!; // a drafts-only mk_ key

function verified(header: string, body: string) {
  const { t, v1 } = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  if (!t || !v1 || Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const expected = createHmac("sha256", SECRET).update(\`\${t}.\${body}\`).digest("hex");
  return v1.length === expected.length && timingSafeEqual(Buffer.from(v1), Buffer.from(expected));
}

createServer(async (req, res) => {
  let body = "";
  for await (const chunk of req) body += chunk;
  if (!verified(String(req.headers["meerko-signature"] ?? ""), body)) return res.writeHead(401).end();
  res.writeHead(200).end(); // answer at once: Meerko waits 10 seconds at most
  const event = JSON.parse(body);
  if (event.type !== "replies.waiting") return;

  for await (const message of query({
    prompt: \`Run Meerko routine \${event.routine.id}: call start_routine_run with that routine_id and follow the brief it returns. Never approve or send.\`,
    options: {
      mcpServers: { meerko: { type: "http", url: "${drafterUrl}", headers: { authorization: \`Bearer \${KEY}\` } } },
      allowedTools: ["mcp__meerko__*"],
    },
  })) {
    if (message.type === "result") console.log(message.subtype);
  }
}).listen(8080);`;

export default function Page() {
  const drafterUrl = new URL("/mcp/drafter", publicApiUrl()).toString();
  const mcpUrl = new URL("/mcp", publicApiUrl()).toString();
  return (
    <DocsShell
      slug="wake-your-agent"
      h1="Autopilot: wake your agent"
      lead={
        <p>
          Replies come in at night, and leads don&apos;t find themselves. Autopilot runs your own AI for you: when replies arrive, or on a
          schedule. Each routine is a brief your AI follows. Meerko starts the run, or checks that your AI&apos;s own schedule did, and shows how
          every run went. Meerko never runs a model: your AI, on your own plan, does the work.
        </p>
      }
      toc={[
        ["how", "How it works"],
        ["routines", "Routines"],
        ["started-by", "What starts a run"],
        ["safety", "What a woken agent can do"],
        ["routine", "Set up a Claude Code routine"],
        ["webhook", "Use a webhook"],
        ["agent-sdk", "Example: the Claude Agent SDK"],
        ["runs", "Runs, and runs that didn't happen"],
        ["timing", "When Meerko starts replies routines"],
      ]}
      tools={["manage_routine", "start_routine_run", "list_replies", "classify_reply", "draft_reply"]}
    >
      <H2 id="how">How it works</H2>
      <Cards
        items={[
          [BellRing, "Replies arrive", <>Within a few minutes Meerko starts your replies routine. Your AI drafts answers with <Tool name="draft_reply" />.</>],
          [CalendarClock, "Or the time comes", <>On the days and time you chose, your AI runs the brief: find leads, enrich them, fill a sequence.</>],
          [ShieldCheck, "You stay in charge", <>Drafts wait in the <L href="/app/inbox">inbox</L> for you to approve. Every run is listed in <L href="/app/autopilot">Autopilot</L>.</>],
        ]}
      />

      <H2 id="routines">Routines</H2>
      <p>
        Create routines in <L href="/app/autopilot">Autopilot</L>, or ask your agent: <Tool name="manage_routine" /> lists, creates, edits,
        pauses, resumes, deletes and runs them, and <C>meerko routines</C> does the same from the terminal. A routine has:
      </p>
      <Fields
        head={["Field", "What it is"]}
        rows={[
          ["Name", "What you call it."],
          ["Brief", "What your AI does on each run, in plain words. Write it for a run with nobody to ask."],
          ["When", <>When new replies arrive (one such routine per workspace), or on a schedule: some weekdays at a time, in your time zone.</>],
        ]}
      />
      <p>
        Every run starts with your AI calling <Tool name="start_routine_run" />. That records the run and hands your AI the brief, so editing
        the brief in Meerko changes what the next run does, without touching your AI.
      </p>

      <H2 id="started-by">What starts a run</H2>
      <Fields
        head={["Started by", "How"]}
        rows={[
          [
            "Your AI's own schedule",
            <>
              You create a recurring task in your AI (for example a routine with a schedule at claude.ai/code/routines, or <C>/schedule</C> in
              Claude Code) with the Meerko connector (<C>{mcpUrl}</C>) and the prompt Autopilot shows. Meerko only checks the run came. Not for
              replies routines: your AI can&apos;t tell when replies arrive.
            </>,
          ],
          ["A Claude Code routine, started by Meerko", <>Meerko calls the routine&apos;s API trigger at each run. See below.</>],
          ["A webhook, called by Meerko", <>Meerko POSTs a signed event to your URL at each run. See below.</>],
        ]}
      />
      <p>
        Only a person signed in to the dashboard chooses what starts a routine, because that&apos;s where its token or URL goes. An agent can
        create and edit routines, but can&apos;t point one at a URL of its choosing.
      </p>

      <H2 id="safety">What a woken agent can do</H2>
      <p>
        A reply is text from someone outside your company, and the agent woken for it reads it with nobody watching. So for a replies routine,
        give it a credential that can only check in, read replies, label them and save drafts:
      </p>
      <Fields
        head={["Credential", "Where"]}
        rows={[
          [<C key="d">{drafterUrl}</C>, "The drafts-only MCP server, for a Claude Code routine's connector. It offers only the reply tools and start_routine_run."],
          ["Drafts-only API key", <>Create one under <L href="/app/settings">Connections → API keys</L> for anything you call with a webhook.</>],
        ]}
      />
      <p>
        Either one is refused if it tries to approve a draft, send email, start a sequence, enrich leads or change settings. Approving stays
        with you. A scheduled routine that finds and enriches leads needs the full connector, <C>{mcpUrl}</C>.
      </p>

      <H2 id="routine">Set up a Claude Code routine</H2>
      <p>
        <L href="https://code.claude.com/docs/en/routines">Routines</L> are Claude Code sessions that run in Anthropic&apos;s cloud with
        nobody at the keyboard. They&apos;re a research preview, need a Claude account with routines turned on, and run on your Claude plan.
      </p>
      <Step n={1} id="routine-create" title="Create the routine in Claude">
        <p>
          In <L href="/app/autopilot">Autopilot</L>, open the routine&apos;s <strong>How it runs</strong>, choose <strong>Claude routine</strong>{" "}
          and copy the <strong>setup prompt</strong>. Paste it into a Claude chat, or run <C>/schedule</C> in Claude Code and paste it there:
          Claude creates the routine with the right connector and instructions, and links you to it. To create it yourself at{" "}
          <L href="https://claude.ai/code/routines">claude.ai/code/routines</L>, keep only the Meerko connector, add no repositories, and use
          the prompt Autopilot shows.
        </p>
      </Step>
      <Step n={2} id="routine-trigger" title="Add an API trigger and paste it into Meerko">
        <p>
          Only the routines page can make an API trigger&apos;s token, so this step is always yours. Open the routine at{" "}
          <L href="https://claude.ai/code/routines">claude.ai/code/routines</L>, choose <strong>Edit</strong>, add an API trigger and
          generate its token (it&apos;s shown once). Paste its URL and token into the routine in Autopilot, then click{" "}
          <strong>Run it now</strong>.
        </p>
      </Step>
      <Callout>
        <p>
          Meerko&apos;s message names the Meerko routine and, for replies, who wrote and the subjects. Claude treats that message as data, so
          the routine&apos;s own prompt tells it to call <Tool name="start_routine_run" /> and follow the brief. Routines accept at most 30 API
          calls an hour, and Meerko starts a replies routine at most once every 5 minutes.
        </p>
      </Callout>

      <H2 id="webhook">Use a webhook</H2>
      <p>
        Any agent that can be started by an HTTP request works: the Claude Agent SDK on your server, a CI job running <C>claude -p</C> or{" "}
        <C>codex exec</C>, or an n8n workflow. For a replies routine Meerko POSTs this JSON to your URL; a scheduled one sends{" "}
        <C>{'"type": "routine.due"'}</C> with <C>due_at</C> instead of <C>replies</C>.
      </p>
      {code("replies.waiting", payload)}
      <p>The payload has no reply text. Your agent fetches it with a drafts-only key.</p>
      <Fields
        head={["Header", "Value"]}
        rows={[
          [
            <C key="s">meerko-signature</C>,
            <>
              <C>t=&lt;unix seconds&gt;,v1=&lt;hex&gt;</C>, where <C>v1</C> is the HMAC-SHA256 of <C>&lt;t&gt;.&lt;raw body&gt;</C> with your
              signing secret (<C>whsec_…</C>, shown once when you save the webhook). Reject old timestamps.
            </>,
          ],
        ]}
      />
      <p>
        URLs must be https and on the public internet. A self-hosted install can call its own network (a local n8n, say) with{" "}
        <C>MEERKO_ALLOW_PRIVATE_HOOKS=1</C>.
      </p>

      <H2 id="agent-sdk">Example: the Claude Agent SDK</H2>
      <p>
        A small server that checks the signature, answers at once and runs a Claude agent with Meerko&apos;s drafts-only MCP server. It
        needs an Anthropic API key in <C>ANTHROPIC_API_KEY</C>.
      </p>
      {code("wake.ts", sdkRecipe(drafterUrl))}

      <H2 id="runs">Runs, and runs that didn&apos;t happen</H2>
      <Fields
        head={["Shown as", "Meaning"]}
        rows={[
          ["ran", <>Your AI checked in with <Tool name="start_routine_run" />.</>],
          ["started", "Meerko started it and the call was accepted; for replies, that's all Meerko waits for."],
          ["failed to start", "Meerko's call failed. The reason is shown, e.g. Claude refusing an expired token."],
          ["no check-in", "Meerko started a scheduled run, but your AI didn't check in within 3 hours."],
          ["missed", "On your AI's own schedule, nothing checked in from 2 hours before the time to 6 hours after."],
        ]}
      />
      <p>
        <strong>Run it now</strong> starts a routine that Meerko starts, whatever the time. If Meerko itself was down at a scheduled time, it
        starts that run late, up to 6 hours after, and skips older ones rather than starting several at once. After a day of failed starts,
        Meerko pauses the routine and says why; fix it and resume it.
      </p>

      <H2 id="timing">When Meerko starts replies routines</H2>
      <Fields
        head={["Rule", "Why"]}
        rows={[
          ["It waits until the oldest new reply is 2 minutes old.", "A burst of replies becomes one run."],
          ["At most one start every 5 minutes.", "Keeps routines under their hourly limit and your agent's bill small."],
          ["Each reply is announced once, after your trigger answers with a 2xx.", "A failed start is retried later with the same replies."],
          ["Replies from before the routine was created are skipped.", "Turning it on doesn't replay your history."],
          ["Bounces, unsubscribes and out-of-office replies never start it.", "Meerko's rules handle those."],
        ]}
      />
    </DocsShell>
  );
}
