import type { Metadata } from "next";
import { citer, GuideShell, H2, Sample } from "@/components/content/guide-shell";

// Targets "claude code use cases" (320/mo, KD 13) and "claude code for marketing/sales" (DataForSEO, US, Oct 2026).
export const metadata: Metadata = {
  title: "Claude Code for Sales: Outbound Use Cases with MCP | Meerko",
  description: "How to use Claude Code for sales and outbound: build lead lists, write sequences and triage replies through an MCP server, with prompts you can copy.",
  alternates: { canonical: "/guides/claude-code-for-sales" },
};

const claudeMcp = { label: "Claude Code docs: Connect to MCP servers", url: "https://code.claude.com/docs/en/mcp-quickstart" };
const sources = [claudeMcp];
const Cite = citer(sources);

const useCases: [string, string, string][] = [
  ["Build a lead list", "find-leads", "Find 50 heads of growth at Series A fintechs in Spain and verify their emails."],
  ["Write a sequence", "write-sequence", "Write a 3-step sequence for the \"Fintech ES\" table and show me a preview. Don't start it yet."],
  ["Triage replies", "triage-replies", "Go through new replies, label each one and draft answers for the interested ones."],
  ["Check the pipeline", "pipeline", "Who replied this week, who booked a meeting, and what's waiting on me?"],
];

export default function Page() {
  return (
    <GuideShell
      slug="claude-code-for-sales"
      eyebrow="Guide · GTM engineering"
      h1="Claude Code for sales and outbound"
      description={metadata.description as string}
      cta="docs"
      lead={
        <p>
          Claude Code isn&apos;t only for code. Connect it to an MCP server with sales tools and it can build lead lists, write
          sequences and work through replies, while you approve anything that emails a real person.
        </p>
      }
      toc={[
        ["how", "How it works: MCP"],
        ["use-cases", "Use cases"],
        ["setup", "Setting it up"],
        ["safety", "Keeping a human in the loop"],
      ]}
      sources={sources}
      faq={[
        ["Can Claude Code send emails?", "Not by itself. It uses the tools of the MCP servers you connect; with an outbound server like Meerko it can draft and schedule emails that send from your own mailbox."],
        ["What is an MCP server?", "A program that gives an AI agent tools, such as searching leads or sending a sequence. Claude Code connects to MCP servers you add with `claude mcp add`."],
        ["Does this work in Cursor or Codex too?", "Yes. Any agent that supports MCP can use the same server; Meerko's setup guide covers Claude Code, Codex, Cursor, Gemini CLI and Windsurf."],
      ]}
    >
      <H2 id="how">How it works: MCP</H2>
      <p>
        Claude Code can use tools beyond its built-in set through the Model Context Protocol (MCP): you add a server, and its
        tools become available in your session.<Cite s={claudeMcp} /> For outbound, that server needs tools for lead data,
        sending and replies. Meerko&apos;s MCP server provides 31 of them, plus four ready-made commands.
      </p>

      <H2 id="use-cases">Use cases</H2>
      <p>Each of these maps to a Meerko command, or you can just ask in plain language:</p>
      {useCases.map(([title, command, prompt]) => (
        <Sample key={command} title={`${title} · /mcp__meerko__${command}`}>
          {`› ${prompt}`}
        </Sample>
      ))}
      <p>
        For the emails themselves, start from the <a href="/guides/cold-email-templates" className="text-accent hover:underline">cold email templates</a>:
        they use the same <code className="font-mono text-fg">{"{{variables}}"}</code> as Meerko sequences.
      </p>

      <H2 id="setup">Setting it up</H2>
      <p>
        Adding a server is one <code className="font-mono text-fg">claude mcp add</code> command.<Cite s={claudeMcp} /> For Meerko,
        that&apos;s the command from the <a href="/docs" className="text-accent hover:underline">setup guide</a>, with your API key
        and the API URL:
      </p>
      <Sample title="Claude Code">
        {"claude mcp add meerko \\\n  -e MEERKO_API_KEY=mk_… \\\n  -e MEERKO_API_URL=… \\\n  -- npx tsx ~/meerko/packages/mcp/src/index.ts"}
      </Sample>

      <H2 id="safety">Keeping a human in the loop</H2>
      <p>
        An agent that can email people needs guardrails. Meerko&apos;s commands never start a sequence or approve a reply on their
        own: sequences start when you say so, and reply drafts wait in your inbox for approval. Replies and unsubscribes stop the
        sequence for that person automatically.
      </p>
    </GuideShell>
  );
}
