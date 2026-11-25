import { Bell, Bot, Database, Mail, Send, Settings, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonClass, Card, Notice, Page, PageHeader, Pill } from "@/components/app/ui";
import { DisconnectMailbox } from "@/components/app/disconnect-mailbox";
import { ResumeMailbox } from "@/components/app/resume-mailbox";
import { TestEmail } from "@/components/app/test-email";
import { ConnectedAppsCard } from "@/components/app/connected-apps-card";
import { SlackCard } from "@/components/app/slack-card";
import { CrmCard } from "@/components/app/crm-card";
import { SendingModeCard } from "@/components/app/sending-mode-card";
import { DigestCard } from "@/components/app/digest-card";
import { MailboxConnect } from "@/components/app/mailbox-connect";
import { connectCtas } from "@/lib/assistant-pages";
import { load, mcpUrl } from "@/lib/meerko";
import { MovedToSettings } from "./moved";
import { headBand, row, SectionHead, SectionNav } from "./parts";

// "WS3 · Connections (2026-11-12)" (f5ab4v) in docs/design/meerko.pen. Ideal customer, API keys, provider keys,
// billing and the workspace moved to Settings (/app/workspace); old links to them are sent there.

type Search = { gmail_connected?: string; gmail_error?: string; billing?: string; billing_error?: string; connect?: string; email?: string; slack?: string };

const providerIcon = { gmail: "bg-ws-red-soft text-ws-red", gmail_imap: "bg-ws-red-soft text-ws-red", outlook: "bg-ws-blue-soft text-ws-blue", imap: "bg-ws-soft text-lk-muted" } as const;

export default async function SettingsPage({ searchParams }: { searchParams: Promise<Search> }) {
  // The API's Gmail OAuth callback redirects back here with the outcome.
  // `?connect=gmail` (from an agent's connect_gmail, or Reconnect) opens the mailbox form.
  const { gmail_connected, gmail_error, billing: paid, billing_error, connect, email, slack } = await searchParams;
  // Stripe now returns to Settings itself; this catches Checkout sessions started before that, and old links.
  if (paid || billing_error) {
    const q = new URLSearchParams({ ...(paid ? { billing: paid } : {}), ...(billing_error ? { billing_error } : {}) });
    redirect(`/app/workspace?${q}#billing`);
  }
  const [mailboxes, credits, apps, me, billing, connectOptions, slackState, sendingMode, crm] = await load((c) =>
    Promise.all([
      c.listMailboxes(),
      c.getCredits(),
      c.listConnectedApps(),
      c.me(),
      c.getBilling(),
      c.mailboxConnectOptions(),
      c.getSlack(),
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

      <MovedToSettings />

      <div className="grid gap-6 lg:grid-cols-[176px_minmax(0,1fr)] lg:gap-10">
        <SectionNav label="Connections" items={nav} />

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

          <ConnectedAppsCard apps={apps} canManage={!!me.user} mcpUrl={mcpUrl()} connect={connectCtas} />

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

          <Link
            href="/app/workspace"
            className="flex items-center gap-3 rounded-lg border border-lk-line bg-lk-frame px-4 py-3 text-[13px] text-lk-muted transition hover:border-lk-gray hover:text-lk-fg"
          >
            <Settings className="size-4 shrink-0" />
            <span className="flex-1">
              Ideal customer, API keys, provider keys{billing.enabled ? ", billing" : ""} and the workspace name are in <span className="font-semibold text-lk-fg">Settings</span>.
            </span>
            <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </Page>
  );
}
