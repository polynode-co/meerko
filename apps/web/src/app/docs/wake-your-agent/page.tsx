import { BellRing, PenLine, ShieldCheck } from "lucide-react";
import { CodeBlock } from "@/components/docs/code-block";
import { DocsShell, docsMetadata } from "@/components/docs/shell";
import { C, Callout, Cards, Fields, H2, L, Step, Tool } from "@/components/docs/ui";
import { ROUTINE_PROMPT, routineSetupPrompt } from "@/lib/agent-hook";
import { publicApiUrl } from "@/lib/meerko";

export const metadata = docsMetadata("wake-your-agent", "Wake your AI agent when cold email replies arrive | Meerko docs");

const code = (title: string, text: string, wrap = false) => <CodeBlock title={title} code={text} wrap={wrap} lines={text.split("\n").map((t) => ({ text: t }))} />;

const payload = `{
  "id": "evt_5f0c…",
  "type": "replies.waiting",
  "created_at": "2026-10-16T07:02:00.000Z",
  "workspace": { "id": "8c1e…", "name": "Acme outbound" },
  "replies": [
    {
      "id": "3d9a…",
      "from": "pia@slalom.example",
      "subject": "Re: Quick question, Pia",
      "received_at": "2026-10-16T06:58:41.000Z",
      "sequence_id": "b71f…"
    }
  ],
  "inbox_url": "https://meerko.ai/app/inbox"
}`;

const sdkRecipe = (drafterUrl: string) => `import { createHmac, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { query } from "@anthropic-ai/claude-agent-sdk";

const SECRET = process.env.MEERKO_WEBHOOK_SECRET!; // whsec_… from Settings
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
  if (JSON.parse(body).type !== "replies.waiting") return;

  for await (const message of query({
    prompt: "New replies arrived in Meerko. Classify each unclassified reply and draft answers for interested ones and questions. Never approve or send.",
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
  return (
    <DocsShell
      slug="wake-your-agent"
      h1="Wake your agent when replies arrive"
      lead={
        <p>
          Replies come in at night. With an agent hook, Meerko calls your own agent as soon as they land, so it can read them and draft the
          answers. In the morning, the drafts are waiting in your inbox for you to approve. Meerko makes the call; your agent, on your own
          plan, does the writing.
        </p>
      }
      toc={[
        ["how", "How it works"],
        ["safety", "What the woken agent can do"],
        ["routine", "Set up a Claude Code routine"],
        ["webhook", "Use a webhook"],
        ["agent-sdk", "Example: the Claude Agent SDK"],
        ["timing", "When Meerko calls"],
      ]}
      tools={["list_replies", "classify_reply", "draft_reply", "list_drafts"]}
    >
      <H2 id="how">How it works</H2>
      <Cards
        items={[
          [BellRing, "Meerko calls", <>A reply from a person arrives. Within a few minutes, Meerko calls your hook once with the list of new replies.</>],
          [PenLine, "Your agent drafts", <>It reads them with <Tool name="list_replies" />, labels them and saves answers with <Tool name="draft_reply" />.</>],
          [ShieldCheck, "You approve", <>Drafts wait in the <L href="/app/inbox">inbox</L>. Nothing is sent until you approve it.</>],
        ]}
      />
      <p>
        Bounces, unsubscribes and out-of-office replies are handled by Meerko&apos;s rules and never wake your agent. Set it up under{" "}
        <L href="/app/settings">Settings → Wake your agent</L>.
      </p>

      <H2 id="safety">What the woken agent can do</H2>
      <p>
        A reply is text from someone outside your company, and the woken agent reads it with nobody watching. So it gets a credential that
        can only read replies, label them and save drafts:
      </p>
      <Fields
        head={["Credential", "Where"]}
        rows={[
          [<C key="d">{drafterUrl}</C>, "The drafts-only MCP server, for a Claude Code routine's connector. It offers only the four reply tools."],
          ["Drafts-only API key", <>Create one under <L href="/app/settings">Settings → API keys</L> for anything you call with a webhook.</>],
        ]}
      />
      <p>
        Either one is refused if it tries to approve a draft, send email, start a sequence, enrich leads or change settings. Approving stays
        with you.
      </p>

      <H2 id="routine">Set up a Claude Code routine</H2>
      <p>
        <L href="https://code.claude.com/docs/en/routines">Routines</L> are Claude Code sessions that run in Anthropic&apos;s cloud with
        nobody at the keyboard. They&apos;re a research preview, need a Claude account with routines turned on, and run on your Claude plan.
      </p>
      <Step n={1} id="routine-connector" title="Add the drafts-only connector">
        <p>
          In claude.ai, add a custom connector with the URL <C>{drafterUrl}</C> and sign in to Meerko when asked.
        </p>
      </Step>
      <Step n={2} id="routine-create" title="Create the routine">
        <p>
          The quickest way is to let Claude create it: paste this into a Claude chat, or run <C>/schedule</C> in Claude Code and paste it
          there. Claude saves the routine and links you to it.
        </p>
        {code("setup prompt", routineSetupPrompt(drafterUrl), true)}
        <p>
          To create it yourself at <L href="https://claude.ai/code/routines">claude.ai/code/routines</L> instead, keep only the Meerko
          connector, add no repositories, and use this prompt:
        </p>
        {code("prompt", ROUTINE_PROMPT, true)}
      </Step>
      <Step n={3} id="routine-trigger" title="Add an API trigger and paste it into Meerko">
        <p>
          Only the routines page can make an API trigger&apos;s token, so this step is always yours. Open the routine at{" "}
          <L href="https://claude.ai/code/routines">claude.ai/code/routines</L>, choose <strong>Edit</strong>, add an API trigger and
          generate its token (it&apos;s shown once). Paste its URL and token under <L href="/app/settings">Settings → Wake your agent</L>, then
          click <strong>Send test</strong>. The routine runs once, with nothing to do.
        </p>
      </Step>
      <Callout>
        <p>
          Meerko sends the routine a short summary: how many replies, who from and the subjects. The routine reads the replies themselves
          through the connector. Routines accept at most 30 API calls an hour, and Meerko calls at most once every 5 minutes.
        </p>
      </Callout>

      <H2 id="webhook">Use a webhook</H2>
      <p>
        Any agent that can be started by an HTTP request works: the Claude Agent SDK on your server, a Cursor cloud agent, a CI job running{" "}
        <C>claude -p</C> or <C>codex exec</C>, or an n8n workflow. Meerko POSTs this JSON to your URL:
      </p>
      {code("replies.waiting", payload)}
      <p>
        The payload has no reply text. Your agent fetches it with a drafts-only key. The Send test button sends{" "}
        <C>{'"type": "test"'}</C> with an empty <C>replies</C> list.
      </p>
      <Fields
        head={["Header", "Value"]}
        rows={[
          [
            <C key="s">meerko-signature</C>,
            <>
              <C>t=&lt;unix seconds&gt;,v1=&lt;hex&gt;</C>, where <C>v1</C> is the HMAC-SHA256 of <C>&lt;t&gt;.&lt;raw body&gt;</C> with your
              signing secret (<C>whsec_…</C>, shown once when you save the hook). Reject old timestamps.
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

      <H2 id="timing">When Meerko calls</H2>
      <Fields
        head={["Rule", "Why"]}
        rows={[
          ["It waits until the oldest new reply is 2 minutes old.", "A burst of replies becomes one call."],
          ["At most one call every 5 minutes.", "Keeps routines under their hourly limit and your agent's bill small."],
          ["Each reply is announced once, after your hook answers with a 2xx.", "A failed call is retried later with the same replies."],
          ["Replies from before you set up the hook are skipped.", "Turning it on doesn't replay your history."],
          ["After a day of failed calls, the hook turns itself off.", "Settings shows the last error. Fix it and turn it back on."],
        ]}
      />
    </DocsShell>
  );
}
