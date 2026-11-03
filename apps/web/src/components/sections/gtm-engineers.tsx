import { Minus, Plus } from "lucide-react";
import { Container, Eyebrow } from "../ui/primitives";

export const faqs = [
  [
    "Is Meerko really free?",
    "Yes. The self-hosted edition is AGPL and has every core feature. You only pay data providers directly with your own keys. Meerko Cloud charges credits for data lookups; AI runs in your own agent.",
  ],
  [
    "Is Meerko an open-source Clay alternative?",
    "For outbound, yes: tables, enrichment and AI columns, plus sending from your own Gmail or Outlook and a reply inbox. The difference is that Meerko is open source, so you can self-host it and keep every row in your own Postgres.",
  ],
  [
    "How do you protect deliverability?",
    "You send from your own mailboxes with daily caps, send windows, jitter and threading. Unsubscribes are honored across every sequence in your workspace.",
  ],
  [
    "Can my AI agent really run campaigns?",
    "Every action is an MCP tool. Replies are drafted for your approval, and the Meerko commands never start a sequence without your OK.",
  ],
  ["Does it work with my CRM?", "Meerko has a light built-in pipeline: new, contacted, replied, meeting, won. CRM sync isn't built yet."],
];

export function GtmEngineers() {
  return (
    <section className="border-t border-line">
      <Container className="flex flex-col gap-14 py-24 lg:flex-row lg:gap-20 lg:py-[120px]">
        <div className="flex flex-col gap-5 lg:w-[480px] lg:shrink-0">
          <Eyebrow>Built for GTM engineers</Eyebrow>
          <h2 className="font-display text-4xl leading-[1.08] font-bold tracking-[-0.03em] lg:text-[44px]">
            You write code. Your outbound should be code too.
          </h2>
          <p className="text-[17px] leading-relaxed text-muted">
            GTM engineers turn go-to-market into systems: data pipelines, enrichment, sequencing, routing. Meerko gives you
            those primitives as an open, scriptable engine — version your plays, test them, and hand them to an agent.
          </p>
          <a href="/guides/gtm-engineer" className="w-fit text-[15px] font-semibold text-accent hover:underline">
            What is a GTM engineer? Read the guide →
          </a>
        </div>
        <div className="flex flex-1 flex-col">
          {faqs.map(([question, answer], i) => (
            <details key={question} open={i === 0} className="group border-b border-line py-6">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[19px] font-semibold [&::-webkit-details-marker]:hidden">
                {question}
                <Plus className="size-5 shrink-0 text-muted group-open:hidden" />
                <Minus className="hidden size-5 shrink-0 text-muted group-open:block" />
              </summary>
              <p className="pt-3 text-base leading-relaxed text-muted">{answer}</p>
            </details>
          ))}
        </div>
      </Container>
    </section>
  );
}
