import { CalendarCheck, ChevronRight, MessageSquareReply, Play, Search, Send, type LucideIcon } from "lucide-react";
import { Container, Eyebrow } from "../ui/primitives";

type Step = { icon: LucideIcon; word: string; value: string; unit: string; bar: string; tone: "accent" | "signal" };

const steps: Step[] = [
  { icon: Search, word: "Find", value: "500", unit: "leads", bar: "h-[150px]", tone: "accent" },
  { icon: Send, word: "Send", value: "450", unit: "emails", bar: "h-[135px]", tone: "accent" },
  { icon: MessageSquareReply, word: "Reply", value: "38", unit: "replies", bar: "h-[48px]", tone: "signal" },
  { icon: CalendarCheck, word: "Book", value: "12", unit: "meetings", bar: "h-[24px]", tone: "signal" },
];

const tone = {
  accent: { text: "text-accent", ring: "border-accent bg-accent-soft", bar: "from-accent to-accent/20", line: "from-accent" },
  signal: { text: "text-signal", ring: "border-signal bg-signal/10", bar: "from-signal to-signal/20", line: "from-signal" },
};

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20">
      <Container className="flex flex-col items-center gap-16 py-24 lg:gap-[72px] lg:py-[120px]">
        <div className="flex flex-col items-center gap-4 text-center">
          <Eyebrow>How it works</Eyebrow>
          <h2 className="font-display text-5xl font-bold tracking-[-0.03em] lg:text-[64px]">Leads in. Meetings out.</h2>
        </div>

        <div className="grid w-full grid-cols-2 gap-x-6 gap-y-12 rounded-3xl border border-line bg-raised px-6 py-10 md:flex md:items-start md:gap-0 md:px-14 md:py-12">
          {steps.map((step, i) => {
            const t = tone[step.tone];
            const next = steps[i + 1];
            return (
              <div key={step.word} className="contents">
                <div className="flex flex-col items-center gap-[18px] md:w-[180px] md:shrink-0">
                  <div className={`flex size-[88px] items-center justify-center rounded-full border-[1.5px] ${t.ring}`}>
                    <step.icon className={`size-9 ${t.text}`} />
                  </div>
                  <span className="font-display text-3xl font-bold tracking-tight">{step.word}</span>
                  <div className="flex h-[160px] w-full items-end justify-center border-b border-line">
                    <div className={`w-24 rounded-t-lg bg-gradient-to-b ${t.bar} ${step.bar}`} />
                  </div>
                  <div className="flex items-end gap-2">
                    <span className={`font-display text-4xl font-bold tracking-tight ${t.text}`}>{step.value}</span>
                    <span className="pb-1 font-mono text-sm text-muted">{step.unit}</span>
                  </div>
                </div>
                {next && (
                  <div className="hidden flex-1 items-center px-2 pt-[43px] md:flex" aria-hidden>
                    <div className={`h-0.5 flex-1 bg-gradient-to-r ${t.line} ${next.tone === "signal" ? "to-signal" : "to-accent"}`} />
                    <ChevronRight className={`size-5 ${tone[next.tone].text}`} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <a
            href="#demo"
            className="inline-flex items-center gap-2.5 rounded-full border border-line bg-white/[0.03] py-3 pr-[18px] pl-3 text-[15px] font-semibold transition hover:border-muted"
          >
            <span className="flex size-7 items-center justify-center rounded-full bg-accent">
              <Play className="size-3.5 fill-dark text-dark" />
            </span>
            Watch the 60-second demo
          </a>
          <span className="font-mono text-xs text-muted">Example campaign · numbers vary</span>
        </div>
      </Container>
    </section>
  );
}
