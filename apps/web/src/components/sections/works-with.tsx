import { CodeXml, Database, Mail, MessageSquare, MousePointer2, Sparkle, Terminal, Wind } from "lucide-react";
import { agentDocs } from "@/lib/sources";
import { Container } from "../ui/primitives";

// Only what Meerko integrates with today. Agents link to their own MCP docs (lib/sources.ts); the rest to our pages.
// The full list is /integrations (lib/integrations.ts).
const tools = [
  [Terminal, "Claude Code", agentDocs["Claude Code"]],
  [MousePointer2, "Cursor", agentDocs.Cursor],
  [CodeXml, "Codex", agentDocs.Codex],
  [Sparkle, "Gemini CLI", agentDocs["Gemini CLI"]],
  [Wind, "Windsurf", agentDocs.Windsurf],
  [Mail, "Gmail", "/integrations/gmail"],
  [Mail, "Outlook", "/integrations/outlook"],
  [MessageSquare, "Slack", "/docs/slack"],
  [Database, "Icypeas", "https://www.icypeas.com"],
] as const;

export function WorksWith() {
  return (
    <section className="border-y border-line">
      <Container className="flex flex-col gap-5 py-7 lg:flex-row lg:items-center lg:gap-10">
        <p className="shrink-0 font-mono text-xs tracking-[0.17em] text-muted">WORKS WITH</p>
        <ul className="flex flex-1 flex-wrap items-center gap-x-8 gap-y-4 lg:justify-between">
          {tools.map(([Icon, name, href]) => {
            const label = (
              <>
                <Icon className="size-[18px]" />
                {name}
              </>
            );
            return (
              <li key={name} className="text-[15px] font-medium text-muted">
                {href ? (
                  <a href={href} {...(href.startsWith("http") ? { target: "_blank", rel: "noopener" } : {})} className="flex items-center gap-2 hover:text-fg">
                    {label}
                  </a>
                ) : (
                  <span className="flex items-center gap-2">{label}</span>
                )}
              </li>
            );
          })}
          <li className="text-[15px] font-semibold">
            <a href="/integrations" className="text-accent hover:underline">All integrations →</a>
          </li>
        </ul>
      </Container>
    </section>
  );
}
