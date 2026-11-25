import type { Metadata } from "next";
import Link from "next/link";
import { saveProfile } from "@/app/app/actions";
import { buttonClass, Card, monoLabel, Page, PageHeader } from "@/components/app/ui";
import { safeNext } from "@/lib/meerko";

// "WS3 · About you" (Y0Vfe) in docs/design/meerko.pen: the questions card; the Ideal customer form stays on Settings.

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
      <PageHeader
        title="About you"
        meta="Three quick questions, all optional. They help us build Meerko for people like you."
        actions={
          <>
            <Link href={next} className={buttonClass("ghost")}>
              Skip
            </Link>
            <button form="about-you" className={buttonClass("primary")}>
              Continue
            </button>
          </>
        }
      />
      <Card raised className="max-w-[560px]">
        <form id="about-you" action={saveProfile} className="flex flex-col gap-6 px-5 py-5">
          <input type="hidden" name="next" value={next} />
          <p className={monoLabel}>You · optional</p>
          {QUESTIONS.map((q) => (
            <fieldset key={q.name} className="flex flex-col">
              <legend className="mb-2.5 text-[13.5px] font-semibold text-lk-fg">{q.label}</legend>
              <div className="flex flex-wrap gap-1.5">
                {q.options.map(([value, text]) => (
                  <label
                    key={value}
                    className="cursor-pointer rounded-md border border-lk-line bg-white px-3 py-[6px] text-[13px] text-lk-muted transition hover:text-lk-fg has-[:checked]:border-lk-fg has-[:checked]:bg-lk-fg has-[:checked]:font-medium has-[:checked]:text-white has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-lk-gray"
                  >
                    <input type="radio" name={q.name} value={value} className="sr-only" />
                    {text}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          <div className="flex flex-wrap items-center gap-2 border-t border-lk-line pt-4 sm:hidden">
            <button className={buttonClass("primary")}>Continue</button>
            <Link href={next} className={buttonClass("ghost")}>
              Skip
            </Link>
          </div>
        </form>
      </Card>
    </Page>
  );
}
