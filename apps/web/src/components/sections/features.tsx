import { Bot, Kanban, Layers, Mail, MessageSquareReply, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Container } from "../ui/primitives";

function Card({
  icon: Icon,
  title,
  body,
  tone = "accent",
  className = "",
  children,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  tone?: "accent" | "signal";
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-3.5 rounded-[18px] border border-line bg-raised p-8 ${className}`}>
      <div className={`flex size-10 items-center justify-center rounded-[10px] ${tone === "signal" ? "bg-signal/10" : "bg-accent-soft"}`}>
        <Icon className={`size-5 ${tone === "signal" ? "text-signal" : "text-accent"}`} />
      </div>
      <h3 className="font-display text-2xl font-bold tracking-tight">{title}</h3>
      <p className="text-[15px] leading-[1.55] text-muted">{body}</p>
      {children}
    </div>
  );
}

const tools = [
  ["create_table", "Build a prospect list"],
  ["enrich_rows", "Run the enrichment waterfall"],
  ["start_sequence", "Send from your inbox"],
  ["list_replies", "Triage what came back"],
];

const mailboxes = [
  ["ana@acme.co", "38 / 50 today", "w-[76%]"],
  ["sales@acme.co", "12 / 50 today", "w-[24%]"],
];

export function Features() {
  return (
    <section>
      <Container className="flex flex-col gap-5 pt-10 pb-24 lg:pb-[120px]">
        <div className="flex flex-col gap-5 lg:flex-row">
          <Card
            icon={Bot}
            title="Agent-native from day one"
            body="One API behind a CLI and an MCP server. Claude Code, Cursor and Codex get the same tools you do — no browser automation, no brittle Zaps."
            className="lg:w-[760px] lg:shrink-0"
          >
            <ul className="flex flex-col gap-2 pt-3">
              {tools.map(([tool, desc]) => (
                <li key={tool} className="flex items-center justify-between gap-4 rounded-lg bg-ink px-3.5 py-2.5 text-sm">
                  <code className="font-mono text-accent">{tool}</code>
                  <span className="text-right text-muted">{desc}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card
            icon={Mail}
            title="Sends from your own inbox"
            body="Connect Gmail or SMTP. Follow-ups thread as replies, with per-mailbox limits, send windows and jitter. Drop the $97/mo sender."
            className="flex-1"
          >
            <div className="flex flex-col gap-2.5 pt-3">
              {mailboxes.map(([box, value, width]) => (
                <div key={box} className="flex flex-col gap-1.5">
                  <div className="flex justify-between font-mono text-[13px]">
                    <span>{box}</span>
                    <span className="text-muted">{value}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-line">
                    <div className={`h-1.5 rounded-full bg-accent ${width}`} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
        <div className="flex flex-col gap-5 md:flex-row">
          <Card
            icon={MessageSquareReply}
            tone="signal"
            title="Closes the reply loop"
            body="Replies stop the sequence, get an intent label and a drafted answer waiting for your approval."
            className="flex-1"
          />
          <Card
            icon={Layers}
            title="Enrichment waterfall"
            body="Apollo, Hunter, Prospeo, ZeroBounce — tried in order, cached, charged only on success. Or bring your own keys."
            className="flex-1"
          />
          <Card
            icon={Kanban}
            title="Pipeline built in"
            body="New → contacted → replied → meeting → won. Start without a CRM; sync to HubSpot later."
            className="flex-1"
          />
        </div>
      </Container>
    </section>
  );
}
