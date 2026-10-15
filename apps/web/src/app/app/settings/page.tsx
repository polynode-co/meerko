import { KeyRound, Mail } from "lucide-react";
import { connectGmail } from "@/app/app/actions";
import { buttonClass, Card, PageHeader, Pill } from "@/components/app/ui";
import { ApiKeysCard } from "@/components/app/api-keys-card";
import { BillingCard } from "@/components/app/billing-card";
import { TestEmail } from "@/components/app/test-email";
import { ConnectedAppsCard } from "@/components/app/connected-apps-card";
import { AgentHookCard } from "@/components/app/agent-hook-card";
import { load, publicApiUrl } from "@/lib/meerko";

type Search = { gmail_connected?: string; gmail_error?: string; billing?: string; billing_error?: string };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<Search> }) {
  // The API's Gmail OAuth callback, and Stripe Checkout, redirect back here with the outcome.
  const { gmail_connected, gmail_error, billing: paid, billing_error } = await searchParams;
  const [mailboxes, credits, keys, apiKeys, apps, me, billing, hook] = await load((c) =>
    Promise.all([c.listMailboxes(), c.getCredits(), c.listProviderKeys(), c.listApiKeys(), c.listConnectedApps(), c.me(), c.getBilling(), c.getAgentHook()]),
  );
  return (
    <div className="flex max-w-4xl flex-col gap-6 px-8 py-7">
      <PageHeader eyebrow="Settings" title="Mailboxes & keys" />

      {gmail_connected && (
        <p className="rounded-lg border border-signal/40 bg-signal/10 px-4 py-3 text-[13px]">
          Gmail connected. Meerko can now send from <span className="font-mono">{gmail_connected}</span>.
        </p>
      )}
      {gmail_error && (
        <p className="rounded-lg border border-[#e5795b]/40 bg-[#e5795b]/10 px-4 py-3 text-[13px]">Gmail not connected: {gmail_error}</p>
      )}

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold"><Mail className="size-4 text-accent" />Mailboxes</h2>
          <form action={connectGmail}>
            <button className={buttonClass("primary")}>Connect Gmail</button>
          </form>
        </div>
        {mailboxes.length === 0 && <p className="px-5 py-6 text-[13px] text-muted">Connect the Gmail or Google Workspace inbox you send from.</p>}
        {mailboxes.map((m) => (
          <div key={m.id} className="flex flex-wrap items-center gap-4 border-b border-line px-5 py-4 last:border-0">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-mono text-[13px]">{m.email}</span>
              {m.lastError && <span className="text-xs text-[#e5795b]">{m.lastError}</span>}
            </span>
            <span className="font-mono text-xs text-muted">{m.rampDay ? `${m.effectiveLimit}/day today · ramp day ${m.rampDay}/21 → ${m.dailyLimit}` : `${m.dailyLimit}/day`}</span>
            <Pill tone={m.status === "active" ? "signal" : "neutral"}>{m.status === "active" ? "connected" : "reconnect"}</Pill>
            {m.status === "active" && <TestEmail mailboxId={m.id} defaultTo={me.user?.email} />}
            {m.status === "error" && (
              <form action={connectGmail}>
                <button className={buttonClass()}>Reconnect</button>
              </form>
            )}
          </div>
        ))}
      </Card>

      {billing.enabled && <BillingCard billing={billing} canManage={me.user?.role === "owner"} paid={paid} error={billing_error} />}

      <ConnectedAppsCard apps={apps} canManage={!!me.user} />

      <AgentHookCard hook={hook} drafterUrl={new URL("/mcp/drafter", publicApiUrl()).toString()} canManage={!!me.user} />

      <ApiKeysCard keys={apiKeys} apiUrl={publicApiUrl()} canManage={!!me.user} />

      <Card className="overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold"><KeyRound className="size-4 text-accent" />{billing.enabled ? "Provider keys" : "Credits & provider keys"}</h2>
        </div>
        <div className="flex flex-col gap-3 px-5 py-4 text-[13px]">
          <p>
            {billing.enabled ? (
              "Bring your own Icypeas key and searches and email finding run on it, with no Meerko credits charged."
            ) : credits.enabled ? (
              <>Balance: <span className="font-mono">{(credits.balance ?? 0).toLocaleString("en")} credits</span>. Found emails cost 8, verifications 1, search results 1. Misses are free.</>
            ) : (
              "Credits are off on this install: searches and enrichment use your own provider keys."
            )}
          </p>
          {keys.length === 0 ? (
            <p className="text-muted">No provider keys. Add your own Icypeas key to skip credits: <span className="font-mono text-fg">pnpm meerko keys set icypeas &lt;key&gt;</span></p>
          ) : (
            keys.map((k) => (
              <p key={k.provider} className="font-mono text-xs">
                {k.provider} · …{k.last4} <span className="text-muted">(no credits charged)</span>
              </p>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
