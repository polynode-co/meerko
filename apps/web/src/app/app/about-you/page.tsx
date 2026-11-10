import type { Metadata } from "next";
import Link from "next/link";
import { saveProfile } from "@/app/app/actions";
import { buttonClass, Card, fieldLabel, Page, PageHeader } from "@/components/app/ui";
import { safeNext } from "@/lib/meerko";

export const metadata: Metadata = { title: "Welcome — Meerko", robots: { index: false } };

// Asked once, right after sign-up (the auth callback and the email-link action send new people here). Every
// question is optional and Skip goes straight on; the answers become PostHog person properties.
const QUESTIONS: { name: string; label: string; options: [string, string][] }[] = [
  {
    name: "role",
    label: "What do you do?",
    options: [
      ["founder", "Founder"],
      ["gtm", "Sales or growth (GTM)"],
      ["agency", "Agency, for clients"],
      ["other", "Something else"],
    ],
  },
  {
    name: "company_size",
    label: "How big is your company?",
    options: [
      ["1", "Just me"],
      ["2-10", "2–10"],
      ["11-50", "11–50"],
      ["51-200", "51–200"],
      ["201+", "201+"],
    ],
  },
  {
    name: "agent",
    label: "Which AI agent will you use with Meerko?",
    options: [
      ["claude", "Claude"],
      ["chatgpt", "ChatGPT"],
      ["claude_code", "Claude Code"],
      ["codex", "Codex"],
      ["cursor", "Cursor"],
      ["other", "Another one"],
      ["none", "None yet"],
    ],
  },
];

export default async function AboutYouPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next) ?? "/app";
  return (
    <Page>
      <PageHeader eyebrow="Welcome" title="Three quick questions" meta="All optional. They help us build Meerko for people like you." />
      <Card>
        <form action={saveProfile} className="flex flex-col gap-7 px-[18px] py-6">
          <input type="hidden" name="next" value={next} />
          {QUESTIONS.map((q) => (
            <fieldset key={q.name} className="flex flex-col gap-3">
              <legend className={`${fieldLabel} mb-3`}>{q.label}</legend>
              <div className="flex flex-wrap gap-2">
                {q.options.map(([value, text]) => (
                  <label
                    key={value}
                    className="cursor-pointer px-4 py-2 text-[15px] text-lk-muted outline outline-1 -outline-offset-1 outline-lk-line has-[:checked]:bg-lk-lime has-[:checked]:text-lk-ink has-[:checked]:outline-lk-lime hover:text-lk-fg"
                  >
                    <input type="radio" name={q.name} value={value} className="sr-only" />
                    {text}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button className={buttonClass("primary")}>Continue</button>
            <Link href={next} className="text-[15px] text-lk-dim hover:text-lk-fg">
              Skip
            </Link>
          </div>
        </form>
      </Card>
    </Page>
  );
}
