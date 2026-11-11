"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { MAIL_PROVIDERS, type MailProviderId } from "@meerko/sdk/constants";
import { connectGmail, connectMailbox, connectOutlook } from "@/app/app/actions";
import { site } from "@/lib/site";
import { buttonClass, cardTitle } from "./ui";

const field = "w-full bg-lk-ink px-3 py-2 text-lk-fg outline outline-1 -outline-offset-1 outline-lk-gray focus:outline-lk-lime text-[15px]";
const link = "text-lk-lime underline-offset-2 hover:underline";

/**
 * The Mailboxes card's header and its connect form. Mailboxes connect over IMAP and SMTP with an app password:
 * Gmail (no Gmail API scopes), a preset provider, or any server. Google's consent page is offered too where
 * the server has it on.
 */
export function MailboxConnect({ oauth, outlook, initialOpen, initialEmail }: { oauth: boolean; outlook: boolean; initialOpen: boolean; initialEmail?: string }) {
  const [open, setOpen] = useState(initialOpen);
  const [done, setDone] = useState<string>();

  return (
    <>
      <div className="flex items-center justify-between border-b border-lk-line px-[18px] py-4">
        <h2 className={cardTitle}>Mailboxes</h2>
        {!open && (
          <button type="button" onClick={() => (setOpen(true), setDone(undefined))} className={buttonClass("primary")}>
            Connect mailbox
          </button>
        )}
      </div>
      {done && <p role="status" className="border-b border-lk-line bg-lk-lime/10 px-[18px] py-3 text-[15px]">{done}</p>}
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
    <>Outlook and Microsoft 365 connect with Sign in with Microsoft instead: pick Outlook above.</>,
  ],
};

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

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => connect(data));
      }}
      className="flex flex-col gap-4 border-b border-lk-line bg-lk-box px-[18px] py-5 text-[15px]"
    >
      <label className="flex max-w-xs flex-col gap-1">
        <span className="font-plex text-[12px] tracking-[0.6px] text-lk-dim uppercase">Email provider</span>
        <select name="provider" value={provider} onChange={(e) => setProvider(e.target.value as MailProviderId)} className={field}>
          {Object.entries(MAIL_PROVIDERS)
            .filter(([id]) => id !== "outlook" || outlook)
            .map(([id, p]) => (
            <option key={id} value={id}>{p.name}</option>
          ))}
        </select>
      </label>

      {provider === "outlook" ? (
        <div className="flex flex-col gap-3">
          <p className="font-semibold">Connect an Outlook or Microsoft 365 inbox</p>
          <p className="text-lk-dim">
            Sign in with Microsoft and approve Meerko: it asks to send email as you and to read your mail, so it can spot replies.
            Microsoft doesn&apos;t allow passwords for this, so there&apos;s nothing to copy. Your IT admin may need to approve Meerko first.
          </p>
          {outlookError && <p role="alert" className="text-[#e5795b]">{outlookError}</p>}
          <div className="flex flex-wrap items-center gap-2">
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
            <button type="button" onClick={onCancel} className={buttonClass("ghost")}>Cancel</button>
          </div>
        </div>
      ) : (
        <>
        <div className="flex flex-col gap-1.5">
          {gmail && outlook && (
            <p className="mb-2 flex flex-wrap items-center gap-2 text-lk-dim">
              Using Outlook or Microsoft 365?
              <button type="button" onClick={() => setProvider("outlook")} className={link}>
                One click with Sign in with Microsoft
              </button>
            </p>
          )}
          <p className="font-semibold">
            {gmail
              ? "Connect a Gmail or Google Workspace inbox with an app password"
              : provider === "other"
                ? "Connect any inbox over IMAP and SMTP"
                : `Connect a ${MAIL_PROVIDERS[provider].name} inbox with an app password`}
          </p>
          <ol className="ml-4 list-decimal space-y-1 text-lk-dim">
            {gmail ? (
              <>
                <li>
                  Turn on{" "}
                  <a href="https://myaccount.google.com/signinoptions/twosv" target="_blank" rel="noreferrer" className={link}>2-Step Verification</a>{" "}
                  for the account, if it isn&apos;t on yet. App passwords only appear once it is.
                </li>
                <li>
                  Open{" "}
                  <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className={link}>App passwords</a>{" "}
                  (Google may ask for your password again).
                </li>
                <li>Under App name, type &quot;Meerko&quot; and click Create.</li>
                <li>Copy the 16-letter password Google shows you. It&apos;s shown once; spaces don&apos;t matter.</li>
                <li>Paste it below with the address. Meerko checks it with Gmail before saving it, encrypted.</li>
              </>
            ) : (
              providerSteps[provider].map((step, i) => <li key={i}>{step}</li>)
            )}
          </ol>
          {gmail && (
            <p className="text-sm text-lk-dim">
              No App passwords page? A Google Workspace admin may have turned it off:{" "}
              <a href="/docs/mailboxes#no-app-password" target="_blank" className={link}>what to check, and the steps for your admin</a>. Still
              stuck? Email <a href={`mailto:${site.contactEmail}`} className={link}>{site.contactEmail}</a>.
            </p>
          )}
          <p className="text-sm text-lk-dim">
            {gmail
              ? "Google emails you a security alert when the password is created and first used. That's expected."
              : "Meerko signs in to your mail server before saving the password, encrypted."}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="font-plex text-[12px] tracking-[0.6px] text-lk-dim uppercase">Address to send from</span>
            <input {...bind("email")} type="email" required placeholder="you@company.com" className={`${field} font-plex`} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-plex text-[12px] tracking-[0.6px] text-lk-dim uppercase">{gmail ? "App password" : "Password or app password"}</span>
            <input name="password" type="password" required autoComplete="off" spellCheck={false} placeholder={gmail ? "abcd efgh ijkl mnop" : ""} className={`${field} font-plex`} />
          </label>
          {provider === "other" && (
            <>
              <label className="flex flex-col gap-1">
                <span className="font-plex text-[12px] tracking-[0.6px] text-lk-dim uppercase">IMAP server (port 993)</span>
                <input {...bind("imap_host")} required placeholder="imap.example.com" className={`${field} font-plex`} />
              </label>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <label className="flex flex-col gap-1">
                  <span className="font-plex text-[12px] tracking-[0.6px] text-lk-dim uppercase">SMTP server</span>
                  <input {...bind("smtp_host")} required placeholder="smtp.example.com" className={`${field} font-plex`} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="font-plex text-[12px] tracking-[0.6px] text-lk-dim uppercase">Port</span>
                  <select {...bind("smtp_port")} className={field}>
                    <option value="465">465</option>
                    <option value="587">587</option>
                  </select>
                </label>
              </div>
            </>
          )}
          <label className="flex flex-col gap-1">
            <span className="font-plex text-[12px] tracking-[0.6px] text-lk-dim uppercase">Sender name (optional)</span>
            <input {...bind("name")} maxLength={100} placeholder="Your name" className={field} />
          </label>
          {alias ? (
            <label className="flex flex-col gap-1">
              <span className="font-plex text-[12px] tracking-[0.6px] text-lk-dim uppercase">{gmail ? "Google account you sign in with" : "User name, if it isn't the address"}</span>
              <input {...bind("login")} placeholder={gmail ? "you@main-domain.com" : ""} className={`${field} font-plex`} />
            </label>
          ) : (
            <button type="button" onClick={() => setAlias(true)} className="self-end text-left text-sm text-lk-dim underline-offset-2 hover:underline">
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
        </>
      )}
    </form>
  );
}
