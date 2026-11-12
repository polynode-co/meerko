"use client";

import { Mail, Plus, X } from "lucide-react";
import { startTransition, useActionState, useEffect, useState } from "react";
import { MAIL_PROVIDERS, type MailProviderId } from "@meerko/sdk/constants";
import { connectGmail, connectMailbox, connectOutlook } from "@/app/app/actions";
import { Modal } from "@/app/app/settings/dialog";
import { modalBody, modalFoot } from "@/app/app/settings/parts";
import { site } from "@/lib/site";
import { buttonClass, field, fieldLabel } from "./ui";

// "WS3 · Modal · Connect mailbox, Gmail" (QAFfd) and "…, Outlook" (lVA15) in docs/design/meerko.pen.

const link = "font-medium text-lk-fg underline-offset-2 hover:underline";
const mono = "font-mono text-[11px] text-lk-dim";

/** Shorter tab names than MAIL_PROVIDERS' own. */
const TAB: Record<MailProviderId, string> = {
  gmail: "Gmail / Google Workspace",
  outlook: "Outlook / Microsoft 365",
  zoho: "Zoho",
  "zoho-eu": "Zoho EU",
  fastmail: "Fastmail",
  other: "Other",
};

/**
 * The Connect mailbox button and its dialog. Mailboxes connect over IMAP and SMTP with an app password: Gmail (no
 * Gmail API scopes), a preset provider, or any server. Google's consent page is offered too where the server has it on.
 */
export function MailboxConnect({ oauth, outlook, initialOpen, initialEmail }: { oauth: boolean; outlook: boolean; initialOpen: boolean; initialEmail?: string }) {
  const [open, setOpen] = useState(initialOpen);
  const [done, setDone] = useState<string>();

  return (
    <>
      <button type="button" onClick={() => (setOpen(true), setDone(undefined))} className={buttonClass("primary")}>
        <Plus /> Connect mailbox
      </button>
      {done && (
        <p
          role="status"
          className="fixed right-5 bottom-5 z-50 flex max-w-[420px] items-start gap-3 rounded-lg border border-[#cde9d6] bg-ws-green-soft px-4 py-3 text-[13px] text-lk-fg shadow-[0_12px_40px_rgba(22,22,26,0.15)]"
        >
          <span className="flex-1">{done}</span>
          <button type="button" onClick={() => setDone(undefined)} aria-label="Dismiss" className="text-lk-dim hover:text-lk-fg">
            <X className="size-3.5" />
          </button>
        </p>
      )}
      {open && (
        <ConnectForm
          oauth={oauth}
          outlook={outlook}
          initialEmail={initialEmail}
          onCancel={() => setOpen(false)}
          onDone={(message) => (setOpen(false), setDone(message))}
        />
      )}
    </>
  );
}

const providerSteps: Record<Exclude<MailProviderId, "gmail" | "outlook">, React.ReactNode[]> = {
  zoho: [
    <>Turn on IMAP in Zoho Mail: Settings → Mail accounts → IMAP</>,
    <>With two-factor on, create an app password at accounts.zoho.com: Security → App passwords</>,
    <>Paste it below. Personal @zoho.com accounts: pick Other, with imap.zoho.com and smtp.zoho.com</>,
  ],
  "zoho-eu": [
    <>Turn on IMAP in Zoho Mail: Settings → Mail accounts → IMAP</>,
    <>With two-factor on, create an app password at accounts.zoho.eu: Security → App passwords</>,
    <>Paste it below. Personal accounts: pick Other, with imap.zoho.eu and smtp.zoho.eu</>,
  ],
  fastmail: [
    <>Create an app password in Fastmail&apos;s settings (Privacy &amp; Security) with IMAP and SMTP access</>,
    <>Your Fastmail plan needs to include IMAP and SMTP</>,
    <>Paste it below</>,
  ],
  other: [
    <>Use your provider&apos;s IMAP and SMTP servers. TLS only: IMAP on 993, SMTP on 465 or 587</>,
    <>Make sure IMAP is on, and use an app password if your provider offers them</>,
    <>Outlook and Microsoft 365 sign in with Microsoft instead: pick Outlook above</>,
  ],
};

function Steps({ children }: { children: React.ReactNode[] }) {
  return (
    <ol className="flex flex-col gap-2">
      {children.map((step, i) => (
        <li key={i} className="flex items-start gap-3 text-[13px] leading-snug text-lk-muted">
          <span className="grid size-[18px] shrink-0 place-items-center rounded-full bg-ws-soft font-mono text-[10px] text-lk-muted">{i + 1}</span>
          <span className="pt-px">{step}</span>
        </li>
      ))}
    </ol>
  );
}

/** Mounted fresh each time it opens, so a past result doesn't linger. */
function ConnectForm({ oauth, outlook, initialEmail, onCancel, onDone }: { oauth: boolean; outlook: boolean; initialEmail?: string; onCancel: () => void; onDone: (message?: string) => void }) {
  const [result, connect, connecting] = useActionState(connectMailbox, null);
  const [alias, setAlias] = useState(false);
  const [provider, setProvider] = useState<MailProviderId>("gmail");
  const gmail = provider === "gmail";
  const [outlookError, setOutlookError] = useState<string>();
  // Submitted by hand (below) so React doesn't reset the form after a refusal: the provider and address stay.
  const [values, setValues] = useState({ email: initialEmail ?? "", name: "", login: "", imap_host: "", smtp_host: "", smtp_port: "465" });
  const bind = (key: keyof typeof values) => ({ name: key, value: values[key], onChange: (e: { target: { value: string } }) => setValues({ ...values, [key]: e.target.value }) });
  useEffect(() => {
    if (result?.ok) onDone(result.message);
  }, [result, onDone]);

  const providers = (Object.keys(MAIL_PROVIDERS) as MailProviderId[]).filter((id) => id !== "outlook" || outlook);
  const label = (text: string, input: React.ReactNode) => (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className={fieldLabel}>{text}</span>
      {input}
    </label>
  );

  return (
    <Modal title="Connect a mailbox" onClose={onCancel} width={600}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          startTransition(() => connect(data));
        }}
      >
        <input type="hidden" name="provider" value={provider} />
        <div className={modalBody}>
          <div role="tablist" aria-label="Email provider" className="-mx-5 -mt-1 flex gap-5 overflow-x-auto border-b border-lk-line px-5">
            {providers.map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={provider === id}
                onClick={() => setProvider(id)}
                className={`-mb-px shrink-0 border-b-2 pt-0.5 pb-2.5 text-[13px] whitespace-nowrap transition ${provider === id ? "border-lk-fg font-semibold text-lk-fg" : "border-transparent text-lk-dim hover:text-lk-fg"}`}
              >
                {TAB[id]}
              </button>
            ))}
          </div>

          {provider === "outlook" ? (
            <>
              <div className="flex items-center gap-3 rounded-lg border border-lk-line px-4 py-3.5">
                <span className="grid size-8 shrink-0 place-items-center rounded-md bg-ws-blue-soft text-ws-blue">
                  <Mail className="size-4" />
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[13.5px] font-medium text-lk-fg">Sign in with Microsoft and approve Meerko</span>
                  <span className={mono}>permissions: send as you · read mail to spot replies</span>
                </span>
              </div>
              <p className={mono}>no password to copy · your IT admin may need to approve Meerko first</p>
              {outlookError && (
                <p role="alert" className="text-[13px] text-ws-red">
                  {outlookError}
                </p>
              )}
            </>
          ) : (
            <>
              <Steps>
                {gmail
                  ? [
                      <>
                        Turn on{" "}
                        <a href="https://myaccount.google.com/signinoptions/twosv" target="_blank" rel="noreferrer" className={link}>
                          2-Step Verification ↗
                        </a>{" "}
                        <span className="text-lk-dim">(app passwords only appear once it&apos;s on)</span>
                      </>,
                      <>
                        Open{" "}
                        <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className={link}>
                          App passwords ↗
                        </a>
                      </>,
                      <>Name it &quot;Meerko&quot;, click Create</>,
                      <>Copy the 16-letter password (spaces don&apos;t matter)</>,
                      <>Paste it below. Google emails you a security alert: that&apos;s expected</>,
                    ]
                  : providerSteps[provider]}
              </Steps>

              <div className="grid gap-x-3 gap-y-3.5 sm:grid-cols-2">
                {label("Address to send from", <input {...bind("email")} type="email" required placeholder="you@company.com" className={`${field} font-mono`} />)}
                {label(
                  gmail ? "App password" : "Password or app password",
                  <input name="password" type="password" required autoComplete="off" spellCheck={false} placeholder={gmail ? "abcd efgh ijkl mnop" : ""} className={`${field} font-mono`} />,
                )}
                {provider === "other" && (
                  <>
                    {label("IMAP server (port 993)", <input {...bind("imap_host")} required placeholder="imap.example.com" className={`${field} font-mono`} />)}
                    <div className="grid grid-cols-[1fr_auto] gap-2">
                      {label("SMTP server", <input {...bind("smtp_host")} required placeholder="smtp.example.com" className={`${field} font-mono`} />)}
                      {label(
                        "Port",
                        <select {...bind("smtp_port")} className={field}>
                          <option value="465">465</option>
                          <option value="587">587</option>
                        </select>,
                      )}
                    </div>
                  </>
                )}
                {label("Sender name (optional)", <input {...bind("name")} maxLength={100} placeholder="Your name" className={field} />)}
                {alias ? (
                  label(gmail ? "Google account you sign in with" : "User name, if it isn't the address", <input {...bind("login")} placeholder={gmail ? "you@main-domain.com" : ""} className={`${field} font-mono`} />)
                ) : (
                  <button type="button" onClick={() => setAlias(true)} className="self-end py-2 text-left text-[13px] text-lk-muted underline-offset-2 hover:text-lk-fg hover:underline">
                    {gmail ? "Alias of another Google account?" : "Sign in with a different user name?"}
                  </button>
                )}
              </div>

              {result && !result.ok && (
                <p role="alert" className="rounded-md border border-[#f3c9c9] bg-ws-red-soft px-3 py-2 text-[13px] text-lk-fg">
                  {result.error}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-t border-lk-line pt-3.5">
                <span className={mono}>{gmail ? "checked with Gmail, then stored encrypted" : "checked with your mail server, then stored encrypted"}</span>
                {gmail && (
                  <span className="flex flex-wrap items-center gap-x-3 text-[13px]">
                    <a href="/docs/mailboxes#no-app-password" target="_blank" className={link}>
                      No App passwords page? →
                    </a>
                    <a href={`mailto:${site.contactEmail}`} className="text-lk-muted underline-offset-2 hover:text-lk-fg hover:underline">
                      Email us
                    </a>
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        <div className={modalFoot}>
          {provider === "outlook" ? (
            <>
              <button type="button" onClick={onCancel} className={buttonClass("secondary")}>
                Cancel
              </button>
              <button
                type="button"
                disabled={connecting}
                onClick={() =>
                  startTransition(async () => {
                    const res = await connectOutlook();
                    if (res && !res.ok) setOutlookError(res.error);
                  })
                }
                className={buttonClass("primary")}
              >
                Sign in with Microsoft
              </button>
            </>
          ) : (
            <>
              {oauth && gmail && (
                <button type="button" onClick={() => startTransition(() => connectGmail())} className={`${buttonClass("ghost")} mr-auto`}>
                  Use Google&apos;s consent page instead
                </button>
              )}
              <button type="button" onClick={onCancel} className={buttonClass("secondary")}>
                Cancel
              </button>
              <button disabled={connecting} className={buttonClass("primary")}>
                {connecting ? (gmail ? "Checking with Gmail…" : "Checking with your mail server…") : "Connect"}
              </button>
            </>
          )}
        </div>
      </form>
    </Modal>
  );
}
