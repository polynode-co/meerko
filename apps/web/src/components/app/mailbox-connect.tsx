"use client";

import { Mail } from "lucide-react";
import { startTransition, useActionState, useEffect, useState } from "react";
import { MAIL_PROVIDERS, type MailProviderId } from "@meerko/sdk/constants";
import { connectGmail, connectMailbox } from "@/app/app/actions";
import { buttonClass } from "./ui";

const field = "w-full rounded-lg border border-line bg-ink px-3 py-2 text-[13px] outline-none focus:border-accent";
const link = "text-accent underline-offset-2 hover:underline";

/**
 * The Mailboxes card's header and its connect form. Mailboxes connect over IMAP and SMTP with an app password:
 * Gmail (no Gmail API scopes), a preset provider, or any server. Google's consent page is offered too where
 * the server has it on.
 */
export function MailboxConnect({ oauth, initialOpen, initialEmail }: { oauth: boolean; initialOpen: boolean; initialEmail?: string }) {
  const [open, setOpen] = useState(initialOpen);
  const [done, setDone] = useState<string>();

  return (
    <>
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold"><Mail className="size-4 text-accent" />Mailboxes</h2>
        {!open && (
          <button type="button" onClick={() => (setOpen(true), setDone(undefined))} className={buttonClass("primary")}>
            Connect mailbox
          </button>
        )}
      </div>
      {done && <p role="status" className="border-b border-line bg-signal/10 px-5 py-3 text-[13px]">{done}</p>}
      {open && (
        <ConnectForm
          oauth={oauth}
          initialEmail={initialEmail}
          onCancel={() => setOpen(false)}
          onDone={(message) => (setOpen(false), setDone(message))}
        />
      )}
    </>
  );
}

const providerSteps: Record<Exclude<MailProviderId, "gmail">, React.ReactNode[]> = {
  zoho: [
    <>Turn on IMAP access in Zoho Mail: Settings → Mail accounts → IMAP.</>,
    <>If you use two-factor authentication, create an app password at accounts.zoho.com: Security → App passwords.</>,
    <>Paste it below. Personal @zoho.com accounts: pick Other, with imap.zoho.com and smtp.zoho.com.</>,
  ],
  "zoho-eu": [
    <>Turn on IMAP access in Zoho Mail: Settings → Mail accounts → IMAP.</>,
    <>If you use two-factor authentication, create an app password at accounts.zoho.eu: Security → App passwords.</>,
    <>Paste it below. Personal accounts: pick Other, with imap.zoho.eu and smtp.zoho.eu.</>,
  ],
  fastmail: [
    <>Create an app password in Fastmail&apos;s settings (Privacy &amp; Security) with access to IMAP and SMTP.</>,
    <>Your Fastmail plan needs to include IMAP and SMTP.</>,
    <>Paste it below.</>,
  ],
  other: [
    <>Use the IMAP and SMTP servers your provider publishes. Meerko connects over TLS only: IMAP on port 993, SMTP on 465 or 587.</>,
    <>Make sure IMAP is on for the account, and use an app password if your provider offers them.</>,
    <>Outlook and Microsoft 365 don&apos;t allow password sign-in, so they can&apos;t connect this way yet.</>,
  ],
};

/** Mounted fresh each time it opens, so a past result doesn't linger. */
function ConnectForm({ oauth, initialEmail, onCancel, onDone }: { oauth: boolean; initialEmail?: string; onCancel: () => void; onDone: (message?: string) => void }) {
  const [result, connect, connecting] = useActionState(connectMailbox, null);
  const [alias, setAlias] = useState(false);
  const [provider, setProvider] = useState<MailProviderId>("gmail");
  const gmail = provider === "gmail";
  // Submitted by hand (below) so React doesn't reset the form after a refusal: the provider and address stay.
  const [values, setValues] = useState({ email: initialEmail ?? "", name: "", login: "", imap_host: "", smtp_host: "", smtp_port: "465" });
  const bind = (key: keyof typeof values) => ({ name: key, value: values[key], onChange: (e: { target: { value: string } }) => setValues({ ...values, [key]: e.target.value }) });
  useEffect(() => {
    if (result?.ok) onDone(result.message);
  }, [result, onDone]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => connect(data));
      }}
      className="flex flex-col gap-4 border-b border-line bg-raised px-5 py-5 text-[13px]"
    >
      <label className="flex max-w-xs flex-col gap-1">
        <span className="text-xs text-muted">Email provider</span>
        <select name="provider" value={provider} onChange={(e) => setProvider(e.target.value as MailProviderId)} className={field}>
          {Object.entries(MAIL_PROVIDERS).map(([id, p]) => (
            <option key={id} value={id}>{p.name}</option>
          ))}
        </select>
      </label>

      <div className="flex flex-col gap-1.5">
        <p className="font-semibold">
          {gmail
            ? "Connect a Gmail or Google Workspace inbox with an app password"
            : provider === "other"
              ? "Connect any inbox over IMAP and SMTP"
              : `Connect a ${MAIL_PROVIDERS[provider].name} inbox with an app password`}
        </p>
        <ol className="ml-4 list-decimal space-y-1 text-muted">
          {gmail ? (
            <>
              <li>
                Turn on{" "}
                <a href="https://myaccount.google.com/signinoptions/twosv" target="_blank" rel="noreferrer" className={link}>2-Step Verification</a>{" "}
                for the account, if it isn&apos;t on yet.
              </li>
              <li>
                <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className={link}>Create an app password</a>: name it
                &quot;Meerko&quot; and copy the 16 letters Google shows you.
              </li>
              <li>Paste it below. Meerko checks it with Gmail before saving it, encrypted.</li>
            </>
          ) : (
            providerSteps[provider].map((step, i) => <li key={i}>{step}</li>)
          )}
        </ol>
        <p className="text-xs text-muted">
          {gmail
            ? "Google emails you a security alert when the password is created and first used. That's expected."
            : "Meerko signs in to your mail server before saving the password, encrypted."}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Address to send from</span>
          <input {...bind("email")} type="email" required placeholder="you@company.com" className={`${field} font-mono`} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">{gmail ? "App password" : "Password or app password"}</span>
          <input name="password" type="password" required autoComplete="off" spellCheck={false} placeholder={gmail ? "abcd efgh ijkl mnop" : ""} className={`${field} font-mono`} />
        </label>
        {provider === "other" && (
          <>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted">IMAP server (port 993)</span>
              <input {...bind("imap_host")} required placeholder="imap.example.com" className={`${field} font-mono`} />
            </label>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted">SMTP server</span>
                <input {...bind("smtp_host")} required placeholder="smtp.example.com" className={`${field} font-mono`} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted">Port</span>
                <select {...bind("smtp_port")} className={field}>
                  <option value="465">465</option>
                  <option value="587">587</option>
                </select>
              </label>
            </div>
          </>
        )}
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Sender name (optional)</span>
          <input {...bind("name")} maxLength={100} placeholder="Your name" className={field} />
        </label>
        {alias ? (
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">{gmail ? "Google account you sign in with" : "User name, if it isn't the address"}</span>
            <input {...bind("login")} placeholder={gmail ? "you@main-domain.com" : ""} className={`${field} font-mono`} />
          </label>
        ) : (
          <button type="button" onClick={() => setAlias(true)} className="self-end text-left text-xs text-muted underline-offset-2 hover:underline">
            {gmail ? "Is this address an alias of another Google account?" : "Do you sign in with a different user name?"}
          </button>
        )}
      </div>

      {result && !result.ok && <p role="alert" className="text-[#e5795b]">{result.error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <button disabled={connecting} className={buttonClass("primary")}>{connecting ? (gmail ? "Checking with Gmail…" : "Checking with your mail server…") : "Connect"}</button>
        <button type="button" onClick={onCancel} className={buttonClass("ghost")}>Cancel</button>
        {oauth && gmail && (
          <button type="button" onClick={() => startTransition(() => connectGmail())} className={`${buttonClass("ghost")} ml-auto`}>
            Use Google&apos;s consent page instead
          </button>
        )}
      </div>
    </form>
  );
}
