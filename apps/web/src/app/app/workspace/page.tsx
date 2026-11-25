import { Building2, CreditCard, KeyRound, Target, Wrench, type LucideIcon } from "lucide-react";
import { Page, PageHeader } from "@/components/app/ui";
import { ApiKeysCard } from "@/components/app/api-keys-card";
import { BillingCard } from "@/components/app/billing-card";
import { ProviderKeysCard } from "@/components/app/provider-keys-card";
import { WorkspaceCard } from "@/components/app/workspace-card";
import { IcpCard } from "@/components/app/icp-card";
import { SectionNav } from "@/app/app/settings/parts";
import { load, publicApiUrl } from "@/lib/meerko";

// Settings: who you sell to, keys, billing and the workspace itself. Connections (/app/settings) keeps what Meerko is
// connected to (mailboxes, your agent, Slack, CRM); that page sends its old #icp, #api-keys, #provider-keys,
// #billing and #workspace links, and Stripe's ?billing= return, here.

type Search = { billing?: string; billing_error?: string };

export default async function WorkspaceSettingsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { billing: paid, billing_error } = await searchParams;
  const [credits, keys, apiKeys, me, billing, icp] = await load((c) =>
    Promise.all([c.getCredits(), c.listProviderKeys(), c.listApiKeys(), c.me(), c.getBilling(), c.getIcp()]),
  );

  const balance = billing.enabled ? billing.balance : credits.enabled ? (credits.balance ?? 0) : null;
  const meta = [
    me.workspace.name,
    billing.enabled && `${billing.plan === "free" ? "Free" : "Pro"} plan`,
    balance !== null && `${balance.toLocaleString("en")} credits`,
  ]
    .filter(Boolean)
    .join(" · ");

  const nav: [string, string, LucideIcon, number?][] = [
    ["icp", "Ideal customer", Target],
    ["api-keys", "API keys", KeyRound, apiKeys.length],
    ["provider-keys", billing.enabled ? "Provider keys" : "Credits & keys", Wrench],
    ...(billing.enabled ? [["billing", "Billing", CreditCard] as [string, string, LucideIcon]] : []),
    ...(me.user ? [["workspace", "Workspace", Building2] as [string, string, LucideIcon]] : []),
  ];

  return (
    <Page>
      <PageHeader title="Settings" meta={meta} />

      <div className="grid gap-6 lg:grid-cols-[176px_minmax(0,1fr)] lg:gap-10">
        <SectionNav label="Settings" items={nav} />

        <div className="flex min-w-0 flex-col gap-9">
          <IcpCard icp={icp} />

          <ApiKeysCard keys={apiKeys} apiUrl={publicApiUrl()} canManage={!!me.user} />

          <ProviderKeysCard keys={keys} title={billing.enabled ? "Provider keys" : "Credits & provider keys"} locked={billing.enabled && billing.plan === "free"}>
            {billing.enabled && billing.plan === "free" ? (
              <>
                Your own keys are a Pro feature on Meerko Cloud; on Free, lookups run on Meerko&apos;s keys and your credits. Upgrade below, or{" "}
                <a href="/docs/self-hosting" className="text-lk-fg underline underline-offset-2">
                  self-host Meerko
                </a>{" "}
                to use your own keys for free.
              </>
            ) : billing.enabled ? (
              "Your own keys run lookups with no Meerko credits charged."
            ) : credits.enabled ? (
              <>
                Balance <span className="font-mono font-semibold text-lk-fg">{(credits.balance ?? 0).toLocaleString("en")} credits</span>. Found emails cost 5,
                verifications 1, search results 1, phone numbers 80; misses are free. Your own keys skip credits.
              </>
            ) : (
              "Credits are off on this install: searches and enrichment use your own provider keys."
            )}
          </ProviderKeysCard>

          {billing.enabled && <BillingCard billing={billing} canManage={me.user?.role === "owner"} paid={paid} error={billing_error} />}

          {me.user && <WorkspaceCard id={me.workspace.id} name={me.workspace.name} canManage={me.user.role === "owner"} />}
        </div>
      </div>
    </Page>
  );
}
