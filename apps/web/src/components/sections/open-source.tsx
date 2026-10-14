import { site } from "@/lib/site";
import { GitHubIcon } from "../ui/brand";
import { Container, Eyebrow, SectionTitle, TrafficLights } from "../ui/primitives";

const stats = [
  ["AGPL-3.0", "License"],
  ["BYOK", "Your keys, no markup"],
  ["Postgres", "Your data, your database"],
];

// The README's self-host steps; the output lines are what the scripts print.
const lines: [string, string][] = [
  ["$ git clone https://github.com/polynode-co/meerko", "text-fg"],
  ["$ cd meerko && pnpm install && cp .env.example .env", "text-fg"],
  ["$ pnpm db:up && pnpm db:migrate", "text-fg"],
  ["Migrations applied.", "text-signal"],
  ['$ pnpm db:seed "My workspace"', "text-fg"],
  ["API key:   mk_••••••••", "text-signal"],
  ["$ pnpm --filter @meerko/api dev", "text-fg"],
  ["Meerko API listening on http://localhost:8787", "text-muted"],
];

export function OpenSource() {
  return (
    <section className="bg-sand text-dark">
      <Container className="flex flex-col items-center gap-14 py-24 lg:flex-row lg:gap-20 lg:py-[120px]">
        <div className="flex flex-1 flex-col gap-5">
          <Eyebrow tone="deep">Self-host it · Fork it · Own your data</Eyebrow>
          <SectionTitle className="text-dark">100% open source.</SectionTitle>
          <p className="text-lg leading-[1.55] text-dark-muted">
            Meerko is AGPL-licensed. Run the whole stack on your own infra, bring your own provider keys
            and keep every lead, email and reply in your Postgres. Or skip the ops and use Meerko Cloud.
          </p>
          <dl className="flex flex-wrap gap-10 pt-3">
            {stats.map(([value, label]) => (
              <div key={label} className="flex flex-col-reverse gap-1">
                <dt className="text-sm text-dark-muted">{label}</dt>
                <dd className="font-display text-[28px] font-bold">{value}</dd>
              </div>
            ))}
          </dl>
          <a
            href={site.githubUrl}
            className="inline-flex w-fit items-center gap-2.5 rounded-[10px] bg-dark px-5 py-3.5 text-[15px] font-semibold text-fg transition hover:bg-black"
          >
            <GitHubIcon className="size-[18px]" />
            Star Meerko on GitHub
          </a>
        </div>
        <div className="w-full overflow-hidden rounded-[14px] bg-ink shadow-[0_24px_48px_rgba(26,22,17,0.25)] lg:w-[600px] lg:shrink-0">
          <div className="flex items-center gap-2 border-b border-line px-4 py-3">
            <TrafficLights />
            <span className="font-mono text-xs text-muted">zsh — self-host</span>
          </div>
          <div className="flex flex-col gap-2 overflow-x-auto px-6 py-[22px] font-mono text-sm leading-normal">
            {lines.map(([text, color]) => (
              <span key={text} className={`whitespace-pre ${color}`}>
                {text}
              </span>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
