import { CreditCard } from "lucide-react";
import type { Billing } from "@meerko/sdk";
import { buyCredits, manageBilling, upgradeToPro } from "@/app/app/actions";
import { buttonClass, Card, Pill } from "@/components/app/ui";

// The Pro price in terraform/app/stripe.tf; credits are always $1 = 100.
const PRO_PRICE = "$49";
const PACK_OPTIONS = [1, 5, 10, 25];
const dollars = (credits: number) => `$${(credits / 100).toLocaleString("en")}`;
const day = (iso: string) => new Date(iso).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" });

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
  const renewal =
    billing.status === "past_due"
      ? "Your last payment failed. Update your card in Manage billing to keep Pro."
      : billing.current_period_end
        ? `${billing.cancel_at_period_end ? "Ends" : "Renews"} ${day(billing.current_period_end)}${billing.cancel_at_period_end ? ", then back to Free" : `, adding ${billing.pro_monthly_credits.toLocaleString("en")} credits`}.`
        : null;

  return (
    <Card className="overflow-hidden">
      <div id="billing" className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold"><CreditCard className="size-4 text-accent" />Plan & credits</h2>
        {canManage && billing.has_customer && (
          <form action={manageBilling}>
            <button className={buttonClass()}>Manage billing</button>
          </form>
        )}
      </div>
      <div className="flex flex-col gap-5 px-5 py-4 text-[13px]">
        {(paid === "pro" || paid === "credits") && (
          // Checkout returns before Stripe's webhook lands, so the balance may lag by a few seconds.
          <p className="rounded-lg border border-signal/40 bg-signal/10 px-4 py-3">
            {paid === "pro" ? "Welcome to Pro. Your monthly credits" : "Payment received. Your credits"} are added as soon as Stripe confirms
            the payment, usually within seconds. Refresh if the balance hasn&apos;t changed yet.
          </p>
        )}
        {error && <p className="rounded-lg border border-[#e5795b]/40 bg-[#e5795b]/10 px-4 py-3">{error}</p>}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <span className="flex items-center gap-2">Plan <Pill tone={pro ? "solid" : "neutral"}>{pro ? "Pro" : "Free"}</Pill></span>
          <span>
            Balance <span className="font-mono">{billing.balance.toLocaleString("en")} credits</span>
          </span>
          {renewal && <span className={billing.status === "past_due" ? "text-[#e5795b]" : "text-muted"}>{renewal}</span>}
        </div>
        <p className="text-muted">Found emails cost 8 credits, verifications 1, search results 1. Misses are free, and credits don&apos;t expire.</p>

        {!canManage && <p className="text-muted">Only a workspace owner can change the plan or buy credits.</p>}

        {canManage && (
          <div className="flex flex-col gap-4 border-t border-line pt-4 sm:flex-row sm:items-end sm:justify-between">
            {!pro && (
              <form action={upgradeToPro} className="flex flex-col gap-2">
                <span className="text-muted">
                  Pro: {billing.pro_monthly_credits.toLocaleString("en")} credits every month and unlimited mailboxes.
                </span>
                <button className={`${buttonClass("primary")} self-start`}>Upgrade to Pro · {PRO_PRICE}/month</button>
              </form>
            )}
            <form action={buyCredits} className="flex flex-col gap-2">
              <label htmlFor="packs" className="text-muted">Top up any time, on any plan:</label>
              <span className="flex gap-2">
                <select id="packs" name="packs" defaultValue="1" className="rounded-lg border border-line bg-raised px-3 py-2 font-mono text-[13px]">
                  {PACK_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {(n * billing.credit_pack).toLocaleString("en")} credits · {dollars(n * billing.credit_pack)}
                    </option>
                  ))}
                </select>
                <button className={buttonClass(pro ? "primary" : "secondary")}>Buy credits</button>
              </span>
            </form>
          </div>
        )}
      </div>
    </Card>
  );
}
