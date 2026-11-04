import Link from "next/link";
import { buttonClass, Card, Notice, Page, PageHeader, Pill } from "@/components/app/ui";

// "LK · App Settings" (hQEjH) in the .pen file.
import { ApiKeysCard } from "@/components/app/api-keys-card";
import { BillingCard } from "@/components/app/billing-card";
import { DisconnectMailbox } from "@/components/app/disconnect-mailbox";
import { TestEmail } from "@/components/app/test-email";
import { ConnectedAppsCard } from "@/components/app/connected-apps-card";
import { AgentHookCard } from "@/components/app/agent-hook-card";
import { SlackCard } from "@/components/app/slack-card";
import { ProviderKeysCard } from "@/components/app/provider-keys-card";
import { MailboxConnect } from "@/components/app/mailbox-connect";
import { WorkspaceCard } from "@/components/app/workspace-card";
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
    <Page className="max-w-[1200px]">
      <PageHeader eyebrow="Settings" title="Mailboxes & keys" />

      {gmail_connected && (
        <Notice ok>
          Mailbox connected. Meerko can now send from <span className="font-plex">{gmail_connected}</span>.
        </Notice>
      )}
      {gmail_error && (
        <Notice ok={false}>Mailbox not connected: {gmail_error}</Notice>
      )}

      <Card>
        {/* Keyed so Reconnect (a new ?email=) opens a fresh form. */}
        <MailboxConnect key={`${connect}:${email}`} oauth={connectOptions.oauth} outlook={connectOptions.outlook} initialOpen={connect === "gmail"} initialEmail={email} />
        {mailboxes.length === 0 && <p className="px-[18px] py-6 text-[15px] text-lk-muted">Connect the inbox you send from: Gmail, Google Workspace, Outlook, Microsoft 365, Zoho, Fastmail or any IMAP/SMTP provider.</p>}
        {mailboxes.map((m) => (
          <div key={m.id} className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-lk-line px-[18px] py-4 last:border-0">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-plex text-[14px] break-all text-lk-fg">{m.email}</span>
              {(m.login || m.servers) && (
                <span className="font-plex text-[12px] text-lk-dim">
                  {[m.servers && `via ${m.servers.imap.host}`, m.login && `signs in as ${m.login}`].filter(Boolean).join(" · ")}
                </span>
              )}
              {m.lastError && <span className="text-sm text-[#e5795b]">{m.lastError}</span>}
            </span>
            <span className="font-plex text-[13px] text-lk-dim">{m.rampDay ? `${m.effectiveLimit}/day today · ramp day ${m.rampDay}/21 → ${m.dailyLimit}` : `${m.dailyLimit}/day`}</span>
            <Pill tone={m.status === "active" ? "solid" : "amber"}>{m.status === "active" ? "connected" : "reconnect"}</Pill>
            {m.status === "active" && <TestEmail mailboxId={m.id} defaultTo={me.user?.email} />}
            {m.status === "error" && (
              <Link href={`/app/settings?connect=gmail&email=${encodeURIComponent(m.email)}`} className={buttonClass("secondary", "sm")}>
                Reconnect
              </Link>
            )}
            <DisconnectMailbox mailboxId={m.id} email={m.email} />
          </div>
        ))}
      </Card>

      {me.user && <WorkspaceCard id={me.workspace.id} name={me.workspace.name} canManage={me.user.role === "owner"} />}

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

      <ProviderKeysCard keys={keys} title={billing.enabled ? "Provider keys" : "Credits & provider keys"}>
        {billing.enabled ? (
          "Bring your own Icypeas key and searches and email finding run on it, with no Meerko credits charged. Add a Firecrawl key and email finding tries it when Icypeas misses, also free."
        ) : credits.enabled ? (
          <>Balance: <span className="font-plex text-lk-lime">{(credits.balance ?? 0).toLocaleString("en")} credits</span>. Found emails cost 8, verifications 1, search results 1. Misses are free. Add your own Icypeas key to skip credits, or a Firecrawl key to find more emails.</>
        ) : (
          "Credits are off on this install: searches and enrichment use your own provider keys."
        )}
      </ProviderKeysCard>
    </Page>
  );
}
