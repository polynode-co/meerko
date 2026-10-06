import { ArrowRight } from "lucide-react";
import Image from "next/image";
import { apiUrl } from "@/lib/meerko";
import { site } from "@/lib/site";
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
const agents = [
  ["Claude Code", "/logos/agents/claude.svg"],
  ["Codex", "/logos/agents/openai.svg"],
  ["Cursor", "/logos/agents/cursor.svg"],
  ["Gemini CLI", "/logos/agents/gemini.svg"],
  ["Windsurf", "/logos/agents/windsurf.svg"],
];

const leads = [
  ["Lucía Ferrer", "Brava Pay", "verified"],
  ["Marc Soler", "Kokoro Finance", "verified"],
  ["Elena Ruiz", "Norte Capital", "found"],
];

/** What an agent does with this prompt: clone the MCP server, register it, and check it works. */
function setupPrompt() {
  return `Set up the Meerko MCP server for me.

1. Clone ${site.githubUrl} somewhere permanent (for example ~/meerko) and run \`pnpm install\` in it. It needs Node 20+ and pnpm.
2. Ask me for my Meerko API key (it starts with mk_). If I don't have one, tell me to create it at ${site.url}/app/settings under "API keys".
3. Register the server. For Claude Code:
   claude mcp add meerko -e MEERKO_API_KEY=<my key> -e MEERKO_API_URL=${apiUrl()} -- npx tsx <clone path>/packages/mcp/src/index.ts
   For Codex, Cursor, Gemini CLI or Windsurf, add the same command and environment variables to that agent's MCP config.
4. Check it works by calling the list_tables tool, then show me the Meerko commands: find-leads, write-sequence, triage-replies and pipeline.`;
}

export function AgentSuperpowers() {
  return (
    <section id="product" className="scroll-mt-20 bg-sand text-dark">
      <Container className="flex flex-col items-center gap-14 py-24 lg:flex-row lg:gap-[72px] lg:py-[112px]">
        <TerminalWindow
          title="claude · meerko mcp"
          className="order-2 w-full shadow-[0_24px_60px_rgba(26,22,17,0.2)] lg:order-1 lg:w-[620px] lg:shrink-0"
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
            <Eyebrow tone="deep">MCP · works in your agent</Eyebrow>
            <SectionTitle className="text-dark">
              Give your agent
              <br />
              outbound superpowers.
            </SectionTitle>
            <p className="text-lg leading-[1.5] text-dark-muted">
              Add Meerko to Claude Code, Codex or Cursor once. Then just ask: your agent finds the leads, writes the emails and
              works the replies.
            </p>
          </div>

          <dl className="flex flex-col">
            {commands.map(([cmd, desc]) => (
              <div key={cmd} className="flex flex-col gap-2 border-b border-dark/12 py-3.5 sm:flex-row sm:items-center sm:gap-6">
                <dt className="sm:w-[210px] sm:shrink-0">
                  <code className="rounded-md border border-dark/15 bg-white/55 px-2.5 py-1.5 font-mono text-[15px]">{cmd}</code>
                </dt>
                <dd className="text-base leading-snug text-dark-muted">{desc}</dd>
              </div>
            ))}
          </dl>

          <div className="flex flex-col gap-3">
            <p className="font-mono text-xs tracking-[0.1em] text-dark-muted">Works with</p>
            <ul className="flex flex-wrap gap-2">
              {agents.map(([name, logo]) => (
                <li
                  key={name}
                  className="flex items-center gap-2 rounded-full border border-dark/10 bg-white/55 py-2 pr-3.5 pl-[11px] text-[13px] font-medium"
                >
                  <Image src={logo} alt="" width={18} height={18} className="size-[18px]" />
                  {name}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap items-center gap-5">
            <CopyButton text={setupPrompt()} label="Copy setup prompt" />
            <a
              href={`${site.githubUrl}#use-from-claude-code-mcp`}
              className="inline-flex items-center gap-1.5 text-base font-semibold hover:text-accent-deep"
            >
              Setup guide <ArrowRight className="size-[17px]" />
            </a>
          </div>
        </div>
      </Container>
    </section>
  );
}
