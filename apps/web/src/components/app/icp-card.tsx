"use client";

import { Bot } from "lucide-react";
import { useActionState, useTransition } from "react";
import type { Icp } from "@meerko/sdk";
import { clearIcp, saveIcp } from "@/app/app/actions";
import { SectionHead } from "@/app/app/settings/parts";
import { buttonClass, Card, field, fieldLabel } from "@/components/app/ui";

const joined = (v?: string[]) => (v ?? []).join(", ");

/** Settings → Ideal customer: who this brand sells to. Every lead in every table is scored 0-100 against it. */
export function IcpCard({ icp }: { icp: Icp | null }) {
  const [state, save, saving] = useActionState(saveIcp, null);
  const [clearing, startClear] = useTransition();
  const input = (name: string, label: string, value: string, placeholder: string, hint?: string) => (
    <label className="flex flex-col gap-1.5">
      <span className={fieldLabel}>{label}</span>
      <input name={name} defaultValue={value} placeholder={placeholder} className={field} />
      {hint && <span className="text-[11.5px] text-lk-dim">{hint}</span>}
    </label>
  );
  return (
    <section id="icp" className="scroll-mt-6">
      <SectionHead title="Ideal customer" note="who your AI looks for · every lead is scored against it" />
      <p className="-mt-1 mb-2.5 max-w-[760px] text-[12.5px] leading-relaxed text-lk-muted">
        Every lead gets a 0–100 fit score: industry 30, title 25, size 20, country 15, keywords 10. Anything ruled out caps it at 10.
      </p>
      <Card>
        {/* Keyed on the saved profile so the form shows what the agent last saved. */}
        <form key={JSON.stringify(icp)} action={save} className="grid gap-x-4 gap-y-3.5 px-4 py-4 sm:grid-cols-2">
          <div className="sm:col-span-2">{input("summary", "In one line", icp?.summary ?? "", "Owner-run consumer brands that sell on Instagram")}</div>
          {input("industries", "Industries", joined(icp?.industries), "Software Development, Financial Services", "LinkedIn industry names, comma-separated")}
          {input("titles", "Buyer titles", joined(icp?.titles), "Founder, Owner, Head of Marketing", "In every language you sell in")}
          {input("countries", "Countries", joined(icp?.countries), "ES, US, GB", "Two-letter codes")}
          <label className="flex flex-col gap-1.5">
            <span className={fieldLabel}>Company size</span>
            <span className="flex items-center gap-2">
              <input name="minHeadcount" type="number" min={0} defaultValue={icp?.headcount?.min ?? ""} placeholder="Min" aria-label="Minimum headcount" className={field} />
              <span className="text-[12.5px] text-lk-dim">to</span>
              <input name="maxHeadcount" type="number" min={0} defaultValue={icp?.headcount?.max ?? ""} placeholder="Max" aria-label="Maximum headcount" className={field} />
            </span>
          </label>
          {input("keywords", "Keywords", joined(icp?.keywords), "instagram, ecommerce", "Words a good fit mentions")}
          {input("exclude", "Rule out", joined(icp?.exclude), "agency, Intern", "Words that make a lead a poor fit")}
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
            <button disabled={saving} className={buttonClass("secondary")}>
              {saving ? "Saving…" : "Save"}
            </button>
            {icp && (
              <button type="button" disabled={clearing} onClick={() => startClear(async () => void (await clearIcp()))} className={buttonClass("ghost")}>
                Remove
              </button>
            )}
            {state && <span className={`text-[12.5px] ${state.ok ? "text-ws-green" : "text-ws-red"}`}>{state.ok ? state.message : state.error}</span>}
          </div>
        </form>
        {!icp && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[#f3e2a6] bg-ws-acc-soft px-4 py-3 text-[13px]">
            <Bot className="size-4 shrink-0 text-ws-acc-ink" />
            <span className="font-semibold text-ws-acc-ink">Or ask your agent</span>
            <span className="font-mono text-[12px] text-lk-fg">“set my ICP from my website, acme.com”</span>
          </div>
        )}
      </Card>
    </section>
  );
}
