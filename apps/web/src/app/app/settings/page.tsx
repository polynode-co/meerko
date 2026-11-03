import { KeyRound } from "lucide-react";
import Link from "next/link";
import { buttonClass, Card, PageHeader, Pill } from "@/components/app/ui";
import { ApiKeysCard } from "@/components/app/api-keys-card";
import { BillingCard } from "@/components/app/billing-card";
import { DisconnectMailbox } from "@/components/app/disconnect-mailbox";
import { TestEmail } from "@/components/app/test-email";
import { ConnectedAppsCard } from "@/components/app/connected-apps-card";
import { AgentHookCard } from "@/components/app/agent-hook-card";
import { SlackCard } from "@/components/app/slack-card";
import { MailboxConnect } from "@/components/app/mailbox-connect";
import { load, publicApiUrl } from "@/lib/meerko";

type Search = { gmail_connected?: string; gmail_error?: string; billing?: string; billing_error?: string; connect?: string; email?: string; slack?: string };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<Search> }) {
  // The API's Gmail OAuth callback, and Stripe Checkout, redirect back here with the outcome.
  // `?connect=gmail` (from an agent's connect_gmail, or Reconnect) opens the mailbox form.
  const { gmail_connected, gmail_error, billing: paid, billing_error, connect, email, slack } = await searchParams;
  const [mailboxes, credits, keys, apiKeys, apps, me, billing, hook, connectOptions, slackState] = await load((c) =>
    Promise.all([
      c.listMailboxes(),
      c.getCredits(),
      c.listProviderKeys(),
      c.listApiKeys(),
      c.listConnectedApps(),
      c.me(),
      c.getBilling(),
      c.getAgentHook(),
      c.mailboxConnectOptions(),
      c.getSlack(),
    ]),
  );
  return (
    <div className="flex max-w-4xl flex-col gap-6 px-8 py-7">
      <PageHeader eyebrow="Settings" title="Mailboxes & keys" />

      {gmail_connected && (
        <p className="rounded-lg border border-signal/40 bg-signal/10 px-4 py-3 text-[13px]">
          Mailbox connected. Meerko can now send from <span className="font-mono">{gmail_connected}</span>.
        </p>
      )}
      {gmail_error && (
        <p className="rounded-lg border border-[#e5795b]/40 bg-[#e5795b]/10 px-4 py-3 text-[13px]">Mailbox not connected: {gmail_error}</p>
      )}

      <Card className="overflow-hidden">
        {/* Keyed so Reconnect (a new ?email=) opens a fresh form. */}
        <MailboxConnect key={`${connect}:${email}`} oauth={connectOptions.oauth} outlook={connectOptions.outlook} initialOpen={connect === "gmail"} initialEmail={email} />
        {mailboxes.length === 0 && <p className="px-5 py-6 text-[13px] text-muted">Connect the inbox you send from: Gmail, Google Workspace, Zoho, Fastmail or any IMAP/SMTP provider.</p>}
        {mailboxes.map((m) => (
          <div key={m.id} className="flex flex-wrap items-center gap-4 border-b border-line px-5 py-4 last:border-0">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-mono text-[13px]">{m.email}</span>
              {(m.login || m.servers) && (
                <span className="font-mono text-[11px] text-muted">
                  {[m.servers && `via ${m.servers.imap.host}`, m.login && `signs in as ${m.login}`].filter(Boolean).join(" · ")}
                </span>
              )}
              {m.lastError && <span className="text-xs text-[#e5795b]">{m.lastError}</span>}
            </span>
            <span className="font-mono text-xs text-muted">{m.rampDay ? `${m.effectiveLimit}/day today · ramp day ${m.rampDay}/21 → ${m.dailyLimit}` : `${m.dailyLimit}/day`}</span>
            <Pill tone={m.status === "active" ? "signal" : "neutral"}>{m.status === "active" ? "connected" : "reconnect"}</Pill>
            {m.status === "active" && <TestEmail mailboxId={m.id} defaultTo={me.user?.email} />}
            {m.status === "error" && (
              <Link href={`/app/settings?connect=gmail&email=${encodeURIComponent(m.email)}`} className={buttonClass()}>
                Reconnect
              </Link>
            )}
            <DisconnectMailbox mailboxId={m.id} email={m.email} />
          </div>
        ))}
      </Card>

      {billing.enabled && <BillingCard billing={billing} canManage={me.user?.role === "owner"} paid={paid} error={billing_error} />}

      <ConnectedAppsCard apps={apps} canManage={!!me.user} />

      <AgentHookCard hook={hook} drafterUrl={new URL("/mcp/drafter", publicApiUrl()).toString()} canManage={!!me.user} />

      <SlackCard
        connection={slackState.connection}
        appAvailable={slackState.app_available}
        canManage={!!me.user}
        notice={
          slack === "connected"
            ? "Slack is connected. New replies and drafts will be posted to the channel you picked."
            : slack === "error"
              ? "Slack wasn't connected. Try Add to Slack again."
              : slack === "cancelled"
                ? "The Slack install was cancelled."
                : undefined
        }
      />

      <ApiKeysCard keys={apiKeys} apiUrl={publicApiUrl()} canManage={!!me.user} />

      <Card className="overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold"><KeyRound className="size-4 text-accent" />{billing.enabled ? "Provider keys" : "Credits & provider keys"}</h2>
        </div>
        <div className="flex flex-col gap-3 px-5 py-4 text-[13px]">
          <p>
            {billing.enabled ? (
              "Bring your own Icypeas key and searches and email finding run on it, with no Meerko credits charged. Add a Firecrawl key and email finding tries it when Icypeas misses, also free."
            ) : credits.enabled ? (
              <>Balance: <span className="font-mono">{(credits.balance ?? 0).toLocaleString("en")} credits</span>. Found emails cost 8, verifications 1, search results 1. Misses are free.</>
            ) : (
              "Credits are off on this install: searches and enrichment use your own provider keys."
            )}
          </p>
          {keys.length === 0 ? (
            <p className="text-muted">
              No provider keys. Add your own Icypeas key to skip credits, or a Firecrawl key to find more emails:{" "}
              <span className="font-mono text-fg">pnpm meerko keys set icypeas|firecrawl &lt;key&gt;</span>
            </p>
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
