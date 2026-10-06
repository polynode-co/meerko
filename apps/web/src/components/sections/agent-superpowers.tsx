import { ArrowRight } from "lucide-react";
import Image from "next/image";
import { mcpUrl } from "@/lib/meerko";
import { site } from "@/lib/site";
import { agentDocs } from "@/lib/sources";
import { CopyButton } from "../ui/copy-button";
import { Container, Eyebrow, SectionTitle, TerminalWindow } from "../ui/primitives";

// Slash commands are the MCP server's prompts (packages/mcp); agents list them under the server's name.
const commands = [
  ["/find-leads", "Build a list from your ideal customer."],
  ["/write-sequence", "Draft a 3-step sequence in your voice."],
  ["/triage-replies", "Sort replies and draft answers to approve."],
  ["/pipeline", "See who's interested, booked and won."],
];

// Logos from Lobe Icons (@lobehub/icons-static-svg); Codex uses the OpenAI mark.
// `mono` marks are black (currentColor in an <img>), so they're inverted on the dark background.
const agents = [
  { name: "Claude Code", logo: "/logos/agents/claude.svg" },
  { name: "Codex", logo: "/logos/agents/openai.svg", mono: true },
  { name: "Cursor", logo: "/logos/agents/cursor.svg", mono: true },
  { name: "Gemini CLI", logo: "/logos/agents/gemini.svg" },
  { name: "Windsurf", logo: "/logos/agents/windsurf.svg", mono: true },
];

const leads = [
  ["Lucía Ferrer", "Brava Pay", "verified"],
  ["Marc Soler", "Kokoro Finance", "verified"],
  ["Elena Ruiz", "Norte Capital", "found"],
];

/** What an agent does with this prompt: add the hosted MCP server, and get the person signed in. */
function setupPrompt() {
  return `Set up the Meerko MCP server for me. It's a hosted server at ${mcpUrl()} that signs me in with my browser (OAuth); there's nothing to install and no API key.

1. Add it. For Claude Code: claude mcp add --transport http --scope user meerko ${mcpUrl()}
   For another agent, follow its docs for adding a remote (HTTP) MCP server by URL; setup for each is at ${site.url}/docs.
2. Tell me to sign in: in Claude Code, run /mcp, pick meerko and authenticate. My browser opens; I continue with Google and click Allow.
3. Once I'm signed in, check it works by calling the list_tables tool, then show me the Meerko commands: find-leads, write-sequence, triage-replies and pipeline.`;
}

export function AgentSuperpowers() {
  return (
    <section id="product" className="scroll-mt-20 border-t border-line">
      <Container className="flex flex-col items-center gap-14 py-24 lg:flex-row lg:gap-[72px] lg:py-[112px]">
        <TerminalWindow
          title="claude · meerko mcp"
          className="order-2 w-full lg:order-1 lg:w-[620px] lg:shrink-0"
        >
          <div className="flex flex-col gap-[18px] overflow-x-auto px-6 pt-6 pb-[26px] font-mono text-[13.5px] leading-normal text-fg">
            <p className="flex gap-2.5">
              <span className="text-accent">›</span>find 50 heads of growth at Series A fintechs in Spain
            </p>
            <div className="flex flex-col gap-1.5">
              <p className="flex gap-2.5 text-muted">
                <span className="text-signal">●</span>
                <span className="whitespace-nowrap">meerko.find_people(title: "head of growth", industry: "fintech")</span>
              </p>
              <div className="grid grid-cols-[150px_170px_auto] pt-1 pl-[22px] whitespace-nowrap">
                {["name", "company", "email"].map((h) => (
                  <span key={h} className="text-muted">{h}</span>
                ))}
                {leads.map(([name, company, email]) => (
                  <span key={name} className="contents">
                    <span>{name}</span>
                    <span>{company}</span>
                    <span className={email === "verified" ? "text-signal" : ""}>{email}</span>
                  </span>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1 text-muted">
              <p className="flex gap-2.5">
                <span className="text-signal">✓</span>Saved 50 leads to "Fintech ES" · 46 verified emails.
              </p>
              <p className="flex gap-2.5">
                <span className="text-accent">→</span>Open in dashboard: <span className="text-fg">Leads › Fintech ES</span>
              </p>
            </div>
          </div>
        </TerminalWindow>

        <div className="order-1 flex w-full flex-1 flex-col gap-10 lg:order-2">
          <div className="flex flex-col gap-5">
            <Eyebrow>MCP · works in your agent</Eyebrow>
            <SectionTitle>
              Give your agent
              <br />
              outbound superpowers.
            </SectionTitle>
            <p className="text-lg leading-[1.5] text-muted">
              Add Meerko to Claude Code, Codex or Cursor once. Then just ask: your agent finds the leads, writes the emails and
              works the replies.
            </p>
          </div>

          <dl className="flex flex-col">
            {commands.map(([cmd, desc]) => (
              <div key={cmd} className="flex flex-col gap-2 border-b border-line py-3.5 sm:flex-row sm:items-center sm:gap-6">
                <dt className="sm:w-[210px] sm:shrink-0">
                  <code className="rounded-md border border-line bg-raised px-2.5 py-1.5 font-mono text-[15px]">{cmd}</code>
                </dt>
                <dd className="text-base leading-snug text-muted">{desc}</dd>
              </div>
            ))}
          </dl>

          <div className="flex flex-col gap-3">
            <p className="font-mono text-xs tracking-[0.1em] text-muted">Works with</p>
            <ul className="flex flex-wrap gap-2">
              {agents.map(({ name, logo, mono }) => (
                <li key={name}>
                  {/* Each agent's own docs for adding an MCP server */}
                  <a
                    href={agentDocs[name]}
                    target="_blank"
                    rel="noopener"
                    className="flex items-center gap-2 rounded-full border border-line bg-raised py-2 pr-3.5 pl-[11px] text-[13px] font-medium hover:border-muted"
                  >
                    <Image src={logo} alt="" width={18} height={18} className={`size-[18px] ${mono ? "invert" : ""}`} />
                    {name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap items-center gap-5">
            <CopyButton text={setupPrompt()} label="Copy setup prompt" />
            <a
              href="/docs/claude-code"
              className="inline-flex items-center gap-1.5 text-base font-semibold hover:text-accent"
            >
              Setup guide <ArrowRight className="size-[17px]" />
            </a>
          </div>
        </div>
      </Container>
    </section>
  );
}
