import type { Billing } from "@meerko/sdk";
import { buyCredits, manageBilling, upgradeToPro } from "@/app/app/actions";
import { SectionHead } from "@/app/app/settings/parts";
import { buttonClass, Card, field, monoLabel, Notice, Pill } from "@/components/app/ui";

// Credits are always $1 = 100. Pro's prices come from the API (core/billing.ts PRO_PRICES, as in stripe.tf).
const PACK_OPTIONS = [1, 5, 10, 25];
const dollars = (credits: number) => `$${(credits / 100).toLocaleString("en")}`;
const day = (iso: string) => new Date(iso).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" });

const cell = "flex min-w-0 flex-col gap-2 bg-white px-4 py-3.5";

/** Plan, balance and the Stripe buttons. Only owners can pay; everyone else sees the state. */
export function BillingCard({
  billing,
  canManage,
  paid,
  error,
}: {
  billing: Extract<Billing, { enabled: true }>;
  canManage: boolean;
  /** Set when Stripe Checkout sends the browser back (`?billing=pro|credits`). */
  paid?: string;
  /** Why a billing action was refused (`?billing_error=`). */
  error?: string;
}) {
  const pro = billing.plan === "pro";
  const pastDue = billing.status === "past_due";
  const end = billing.current_period_end;
  const monthly = billing.pro_monthly_credits.toLocaleString("en");
  const renewal = pastDue
    ? { label: "Payment", value: "failed", sub: "update your card in Manage billing to keep Pro" }
    : end
      ? {
          label: billing.cancel_at_period_end ? "Ends" : "Renews",
          value: day(end),
          sub: billing.cancel_at_period_end
            ? "then back to Free"
            : billing.interval === "year"
              ? `annual · +${monthly} credits every month`
              : `+${monthly} credits`,
        }
      : null;

  return (
    <section id="billing" className="scroll-mt-6">
      <SectionHead title="Plan & credits" note="shared by all your workspaces">
        {canManage && billing.has_customer && (
          <form action={manageBilling}>
            <button className={buttonClass("ghost", "sm")}>Manage billing</button>
          </form>
        )}
      </SectionHead>

      <div className="flex flex-col gap-3">
        {(paid === "pro" || paid === "credits") && (
          // Checkout returns before Stripe's webhook lands, so the balance may lag by a few seconds.
          <Notice ok>
            {paid === "pro" ? "Welcome to Pro. Your monthly credits" : "Payment received. Your credits"} are added as soon as Stripe confirms the payment, usually
            within seconds. Refresh if the balance hasn&apos;t changed yet.
          </Notice>
        )}
        {error && <Notice ok={false}>{error}</Notice>}

        <Card>
          <div className="grid grid-cols-2 bg-lk-line [gap:1px] lg:grid-cols-[0.8fr_0.8fr_1.1fr_1.3fr]">
            <div className={cell}>
              <span className={monoLabel}>Plan</span>
              <span className="flex items-center gap-2">
                <span className="font-display text-[24px] leading-none font-bold tracking-[-0.5px] text-lk-fg">{pro ? "Pro" : "Free"}</span>
                {pro && <Pill tone={pastDue ? "red" : "signal"}>{pastDue ? "past due" : "active"}</Pill>}
              </span>
            </div>
            <div className={cell}>
              <span className={monoLabel}>Credits</span>
              <span className="flex items-baseline gap-1.5">
                <span className="font-display text-[24px] leading-none font-bold tracking-[-0.5px] text-lk-fg">{billing.balance.toLocaleString("en")}</span>
                <span className="font-mono text-[11px] text-lk-dim">left</span>
              </span>
            </div>
            <div className={cell}>
              <span className={monoLabel}>{renewal?.label ?? "Renews"}</span>
              {renewal ? (
                <span className="flex flex-col gap-0.5">
                  <span className={`font-mono text-[12.5px] ${pastDue ? "text-ws-red" : "text-lk-fg"}`}>{renewal.value}</span>
                  <span className="font-mono text-[11px] text-lk-dim">{renewal.sub}</span>
                </span>
              ) : (
                <span className="font-mono text-[12.5px] text-lk-dim">—</span>
              )}
            </div>
            <div className={cell}>
              <span className={monoLabel}>Cost per result</span>
              <span className="flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[11.5px] text-lk-muted">
                <span>
                  email <b className="font-medium text-lk-fg">5</b>
                </span>
                <span>
                  verify <b className="font-medium text-lk-fg">1</b>
                </span>
                <span>
                  search <b className="font-medium text-lk-fg">1</b>
                </span>
                <span>
                  phone <b className="font-medium text-lk-fg">80</b> <span className="text-lk-dim">(Pro)</span>
                </span>
              </span>
              <span className="text-[11.5px] text-lk-dim">Misses are free. Bought credits never expire; Pro&apos;s monthly credits roll over one month.</span>
            </div>
          </div>

          {!canManage && <p className="border-t border-lk-line px-4 py-2.5 text-[12px] text-lk-dim">Only a workspace owner can change the plan or buy credits.</p>}

          {canManage && (
            <div className="flex flex-col gap-4 border-t border-lk-line px-4 py-3.5 md:flex-row md:items-end md:justify-between">
              {!pro && (
                <div className="flex flex-col gap-2">
                  <span className="text-[12.5px] text-lk-muted">
                    Pro: {monthly} credits every month and unlimited mailboxes.
                  </span>
                  <span className="flex flex-wrap gap-2">
                    <form action={upgradeToPro}>
                      <input type="hidden" name="interval" value="month" />
                      <button className={buttonClass("secondary", "sm")}>Upgrade · ${billing.prices.month}/month</button>
                    </form>
                    {billing.prices.year && (
                      <form action={upgradeToPro}>
                        <input type="hidden" name="interval" value="year" />
                        <button className={buttonClass("lime", "sm")}>
                          Upgrade yearly ·{" "}
                          {billing.founding_offer ? (
                            <>
                              <s className="opacity-60">${billing.prices.year}</s> ${Math.round((billing.prices.year * (100 - billing.founding_offer.percent_off)) / 100)} the first year
                            </>
                          ) : (
                            <>${billing.prices.year}/year</>
                          )}
                        </button>
                      </form>
                    )}
                  </span>
                  {billing.prices.year && (
                    <span className="font-mono text-[11px] text-lk-dim">
                      {billing.founding_offer
                        ? `founding offer: ${billing.founding_offer.percent_off}% off the first year · ${billing.founding_offer.left} of 50 left · until ${day(billing.founding_offer.until)}, then $${billing.prices.year}/year`
                        : `yearly works out at $${Math.round(billing.prices.year / 12)}/month, same monthly credits`}
                    </span>
                  )}
                </div>
              )}
              <form action={buyCredits} className="flex flex-col gap-1.5">
                <label htmlFor="packs" className="text-[12.5px] text-lk-muted">
                  Top up any time, on any plan
                </label>
                <span className="flex gap-2">
                  <select id="packs" name="packs" defaultValue="1" className={`${field} w-auto font-mono text-[12px]`}>
                    {PACK_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {(n * billing.credit_pack).toLocaleString("en")} credits · {dollars(n * billing.credit_pack)}
                      </option>
                    ))}
                  </select>
                  <button className={buttonClass("secondary", "sm")}>Buy credits</button>
                </span>
              </form>
            </div>
          )}
        </Card>
      </div>
    </section>
  );
}
