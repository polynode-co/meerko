import { Bell, Bot, Building2, CreditCard, Database, KeyRound, Mail, Send, Target, Wrench, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { buttonClass, Card, Notice, Page, PageHeader, Pill } from "@/components/app/ui";
import { ApiKeysCard } from "@/components/app/api-keys-card";
import { BillingCard } from "@/components/app/billing-card";
import { DisconnectMailbox } from "@/components/app/disconnect-mailbox";
import { ResumeMailbox } from "@/components/app/resume-mailbox";
import { TestEmail } from "@/components/app/test-email";
import { ConnectedAppsCard } from "@/components/app/connected-apps-card";
import { SlackCard } from "@/components/app/slack-card";
import { CrmCard } from "@/components/app/crm-card";
import { SendingModeCard } from "@/components/app/sending-mode-card";
import { DigestCard } from "@/components/app/digest-card";
import { ProviderKeysCard } from "@/components/app/provider-keys-card";
import { MailboxConnect } from "@/components/app/mailbox-connect";
import { WorkspaceCard } from "@/components/app/workspace-card";
import { IcpCard } from "@/components/app/icp-card";
import { load, mcpUrl, publicApiUrl } from "@/lib/meerko";
import { headBand, row, SectionHead } from "./parts";

// "WS3 · Connections (2026-11-12)" (f5ab4v) in docs/design/meerko.pen.

type Search = { gmail_connected?: string; gmail_error?: string; billing?: string; billing_error?: string; connect?: string; email?: string; slack?: string };

const providerIcon = { gmail: "bg-ws-red-soft text-ws-red", gmail_imap: "bg-ws-red-soft text-ws-red", outlook: "bg-ws-blue-soft text-ws-blue", imap: "bg-ws-soft text-lk-muted" } as const;

export default async function SettingsPage({ searchParams }: { searchParams: Promise<Search> }) {
  // The API's Gmail OAuth callback, and Stripe Checkout, redirect back here with the outcome.
  // `?connect=gmail` (from an agent's connect_gmail, or Reconnect) opens the mailbox form.
  const { gmail_connected, gmail_error, billing: paid, billing_error, connect, email, slack } = await searchParams;
  const [mailboxes, credits, keys, apiKeys, apps, me, billing, connectOptions, slackState, icp, sendingMode, crm] = await load((c) =>
    Promise.all([
      c.listMailboxes(),
      c.getCredits(),
      c.listProviderKeys(),
      c.listApiKeys(),
      c.listConnectedApps(),
      c.me(),
      c.getBilling(),
      c.mailboxConnectOptions(),
      c.getSlack(),
      c.getIcp(),
      c.getSendingMode(),
      c.getCrm(),
    ]),
  );
  // Each owner's own setting, so only for a signed-in person.
  const digest = me.user ? await load((c) => c.getDigest()) : null;

  const sending = mailboxes.filter((m) => m.status === "active" && !m.heldAt);
  const today = sending.reduce((n, m) => n + m.effectiveLimit, 0);
  const balance = billing.enabled ? billing.balance : credits.enabled ? (credits.balance ?? 0) : null;
  const approve = sendingMode.sequence_emails === "approve" && sendingMode.reply_drafts === "approve";
  const meta = [
    `${mailboxes.length} ${mailboxes.length === 1 ? "mailbox" : "mailboxes"}`,
    `${apps.length} ${apps.length === 1 ? "agent" : "agents"}`,
    approve ? "approve before sending" : "sends on its own",
    balance !== null && `${balance.toLocaleString("en")} credits`,
  ]
    .filter(Boolean)
    .join(" · ");

  const nav: [string, string, LucideIcon, number?][] = [
    ["mailboxes", "Mailboxes", Mail, mailboxes.length],
    ["agent", "Your agent", Bot, apps.length],
    ["sending-mode", "Sending", Send],
    ["notifications", "Notifications", Bell],
    ["crm", "CRM", Database],
    ["icp", "Ideal customer", Target],
    ["api-keys", "API keys", KeyRound, apiKeys.length],
    ["provider-keys", "Provider keys", Wrench],
    ...(billing.enabled ? [["billing", "Billing", CreditCard] as [string, string, LucideIcon]] : []),
    ...(me.user ? [["workspace", "Workspace", Building2] as [string, string, LucideIcon]] : []),
  ];

  return (
    <Page>
      <PageHeader
        title="Connections"
        meta={meta}
        actions={
          /* Keyed so Reconnect (a new ?email=) opens a fresh form. */
          <MailboxConnect key={`${connect}:${email}`} oauth={connectOptions.oauth} outlook={connectOptions.outlook} initialOpen={connect === "gmail"} initialEmail={email} />
        }
      />

      {gmail_connected && (
        <Notice ok>
          Mailbox connected. Meerko can now send from <span className="font-mono">{gmail_connected}</span>.
        </Notice>
      )}
      {gmail_error && <Notice ok={false}>Mailbox not connected: {gmail_error}</Notice>}

      <div className="grid gap-6 lg:grid-cols-[176px_minmax(0,1fr)] lg:gap-10">
        <nav aria-label="Connections" className="-mx-5 overflow-x-auto px-5 sm:-mx-8 sm:px-8 lg:mx-0 lg:px-0">
          <ul className="flex gap-1 lg:sticky lg:top-6 lg:flex-col lg:gap-0.5">
            {nav.map(([id, name, Icon, count]) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className="flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] whitespace-nowrap text-lk-muted transition hover:bg-lk-frame hover:text-lk-fg"
                >
                  <Icon className="size-[15px] shrink-0" />
                  <span className="flex-1">{name}</span>
                  {!!count && <span className="font-mono text-[10.5px] text-lk-dim">{count}</span>}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex min-w-0 flex-col gap-9">
          <section id="mailboxes" className="scroll-mt-6">
            <SectionHead title="Mailboxes" note={mailboxes.length ? `${sending.length} sending · ${today.toLocaleString("en")}/day today` : undefined} />
            <Card>
              {mailboxes.length === 0 ? (
                <p className="px-4 py-5 text-[13px] text-lk-muted">
                  Connect the inbox you send from: Gmail, Google Workspace, Outlook, Microsoft 365, Zoho, Fastmail or any IMAP/SMTP provider.
                </p>
              ) : (
                <div className={headBand}>
                  <span className="flex-1">Mailbox</span>
                  <span className="w-[96px]">Status</span>
                  <span className="w-[200px]">Sending today</span>
                  <span className="w-[200px]" />
                </div>
              )}
              {mailboxes.map((m) => {
                const limit = m.rampDay ? `${m.effectiveLimit}/day` : `${m.dailyLimit}/day`;
                return (
                  <div key={m.id} className={`${row} min-h-14`}>
                    <span className={`grid size-7 shrink-0 place-items-center rounded-md ${providerIcon[m.provider]}`}>
                      <Mail className="size-3.5" />
                    </span>
                    <span className="flex min-w-[min(100%,200px)] flex-1 flex-col gap-0.5">
                      <span className="font-mono text-[12.5px] break-all text-lk-fg">{m.email}</span>
                      {m.heldAt ? (
                        <span className="text-[12px] text-ws-red">
                          Paused by Meerko: {m.holdDetail}. Its queued emails wait; your other mailboxes keep sending. Fix the cause, then resume it.
                        </span>
                      ) : m.lastError ? (
                        <span className="text-[12px] text-ws-red">{m.lastError}</span>
                      ) : (
                        (m.displayName || m.login || m.servers) && (
                          <span className="text-[12px] text-lk-dim">
                            {[m.displayName, m.servers && `via ${m.servers.imap.host}`, m.login && `signs in as ${m.login}`].filter(Boolean).join(" · ")}
                          </span>
                        )
                      )}
                    </span>
                    <span className="md:w-[96px]">
                      <Pill tone={m.status !== "active" ? "red" : m.heldAt ? "amber" : "signal"}>{m.status !== "active" ? "reconnect" : m.heldAt ? "paused" : "connected"}</Pill>
                    </span>
                    <span className="flex flex-col gap-1.5 md:w-[200px]">
                      {m.status !== "active" ? (
                        <span className="font-mono text-[12px] text-lk-dim">—</span>
                      ) : (
                        <span className="font-mono text-[12px] text-lk-fg">
                          {limit}
                          {m.rampDay && (
                            <span className="ml-2 text-[11px] text-lk-dim">
                              ramp day {m.rampDay}/21 → {m.dailyLimit}
                            </span>
                          )}
                        </span>
                      )}
                      {m.status === "active" && m.rampDay && (
                        <span className="block h-[3px] w-full max-w-[160px] overflow-hidden rounded-full bg-ws-soft">
                          <span className="block h-full rounded-full bg-lk-fg" style={{ width: `${Math.min(100, (m.rampDay / 21) * 100)}%` }} />
                        </span>
                      )}
                    </span>
                    <span className="ml-auto flex flex-wrap items-center justify-end gap-1.5 md:w-[200px]">
                      {m.heldAt && <ResumeMailbox mailboxId={m.id} email={m.email} />}
                      {m.status === "active" && <TestEmail mailboxId={m.id} defaultTo={me.user?.email} />}
                      {m.status === "error" && (
                        <Link href={`/app/settings?connect=gmail&email=${encodeURIComponent(m.email)}`} className={buttonClass("secondary", "sm")}>
                          Reconnect
                        </Link>
                      )}
                      <DisconnectMailbox mailboxId={m.id} email={m.email} limit={limit} />
                    </span>
                  </div>
                );
              })}
            </Card>
          </section>

          <ConnectedAppsCard apps={apps} canManage={!!me.user} mcpUrl={mcpUrl()} />

          <SendingModeCard mode={sendingMode} canManage={!!me.user} />

          <div className="grid gap-9 xl:grid-cols-2 xl:gap-5">
            <section id="notifications" className="min-w-0 scroll-mt-6">
              <SectionHead title="Notifications" />
              <Card>
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
                {digest?.eligible && <DigestCard enabled={digest.enabled} lastSentAt={digest.last_sent_at} />}
              </Card>
            </section>

            <CrmCard connection={crm} canManage={!!me.user} />
          </div>

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
