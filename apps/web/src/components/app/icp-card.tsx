"use client";

import { useActionState, useTransition } from "react";
import type { Icp } from "@meerko/sdk";
import { clearIcp, saveIcp } from "@/app/app/actions";
import { AgentHint, buttonClass, Card, cardTitle, field, fieldLabel } from "@/components/app/ui";

const joined = (v?: string[]) => (v ?? []).join(", ");

/** Settings → Ideal customer: who this brand sells to. Every lead in every table is scored 0-100 against it. */
export function IcpCard({ icp }: { icp: Icp | null }) {
  const [state, save, saving] = useActionState(saveIcp, null);
  const [clearing, startClear] = useTransition();
  const input = (name: string, label: string, value: string, placeholder: string, hint?: string) => (
    <label className="flex flex-col gap-1.5">
      <span className={fieldLabel}>{label}</span>
      <input name={name} defaultValue={value} placeholder={placeholder} className={field} />
      {hint && <span className="text-[13px] text-lk-dim">{hint}</span>}
    </label>
  );
  return (
    <Card id="icp">
      <div className="border-b border-lk-line px-[18px] py-4">
        <h2 className={cardTitle}>Ideal customer</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-lk-muted">
          Who this brand sells to. Every lead gets a fit score from 0 to 100: industry 30, job title 25, company size 20, country 15,
          keywords 10, counting what you set and the lead has. Anything excluded caps a lead at 10. Your agent can fill this in from your
          website and fine-tune scores with a reason.
        </p>
      </div>
      {/* Keyed on the saved profile so the form shows what the agent last saved. */}
      <form key={JSON.stringify(icp)} action={save} className="grid gap-4 px-[18px] py-4 sm:grid-cols-2">
        <div className="sm:col-span-2">{input("summary", "In one line", icp?.summary ?? "", "Owner-run consumer brands that sell on Instagram")}</div>
        {input("industries", "Industries", joined(icp?.industries), "Software Development, Financial Services", "LinkedIn industry names, comma-separated")}
        {input("titles", "Buyer titles", joined(icp?.titles), "Founder, Owner, Head of Marketing", "In every language you sell in")}
        {input("countries", "Countries", joined(icp?.countries), "ES, US, GB", "Two-letter codes")}
        <label className="flex flex-col gap-1.5">
          <span className={fieldLabel}>Company size</span>
          <span className="flex items-center gap-2">
            <input name="minHeadcount" type="number" min={0} defaultValue={icp?.headcount?.min ?? ""} placeholder="Min" className={field} />
            <span className="text-lk-dim">to</span>
            <input name="maxHeadcount" type="number" min={0} defaultValue={icp?.headcount?.max ?? ""} placeholder="Max" className={field} />
          </span>
        </label>
        {input("keywords", "Keywords", joined(icp?.keywords), "instagram, ecommerce", "Words a good fit mentions")}
        {input("exclude", "Rule out", joined(icp?.exclude), "agency, Intern", "Words that make a lead a poor fit")}
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button disabled={saving} className={buttonClass("primary")}>
            {saving ? "Saving…" : "Save"}
          </button>
          {icp && (
            <button type="button" disabled={clearing} onClick={() => startClear(async () => void (await clearIcp()))} className={buttonClass("ghost")}>
              Remove
            </button>
          )}
          {state && <span className={`text-[14px] ${state.ok ? "text-lk-lime" : "text-[#e5795b]"}`}>{state.ok ? state.message : state.error}</span>}
        </div>
      </form>
      {!icp && (
        <div className="px-[18px] pb-4">
          <AgentHint command="set my ICP from my website, acme.com">Or let your agent work it out.</AgentHint>
        </div>
      )}
    </Card>
  );
}
