"use client";

import { Mail } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { connectAppPassword, connectGmail } from "@/app/app/actions";
import { buttonClass } from "./ui";

const field = "w-full rounded-lg border border-line bg-ink px-3 py-2 text-[13px] outline-none focus:border-accent";
const link = "text-accent underline-offset-2 hover:underline";

/**
 * The Mailboxes card's header and its connect form. Mailboxes connect with a Google app password (IMAP and
 * SMTP), which needs no Gmail API scopes. Google's consent page is offered too where the server has it on.
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
            Connect Gmail
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

/** Mounted fresh each time it opens, so a past result doesn't linger. */
function ConnectForm({ oauth, initialEmail, onCancel, onDone }: { oauth: boolean; initialEmail?: string; onCancel: () => void; onDone: (message?: string) => void }) {
  const [result, connect, connecting] = useActionState(connectAppPassword, null);
  const [alias, setAlias] = useState(false);
  // Controlled, because React resets a form after its action runs: a refused password shouldn't clear the address.
  const [values, setValues] = useState({ email: initialEmail ?? "", name: "", login: "" });
  const bind = (key: keyof typeof values) => ({ name: key, value: values[key], onChange: (e: { target: { value: string } }) => setValues({ ...values, [key]: e.target.value }) });
  useEffect(() => {
    if (result?.ok) onDone(result.message);
  }, [result, onDone]);

  return (
    <form action={connect} className="flex flex-col gap-4 border-b border-line bg-raised px-5 py-5 text-[13px]">
      <div className="flex flex-col gap-1.5">
        <p className="font-semibold">Connect a Gmail or Google Workspace inbox with an app password</p>
        <ol className="ml-4 list-decimal space-y-1 text-muted">
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
        </ol>
        <p className="text-xs text-muted">Google emails you a security alert when the password is created and first used. That&apos;s expected.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Address to send from</span>
          <input {...bind("email")} type="email" required placeholder="you@company.com" className={`${field} font-mono`} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">App password</span>
          <input name="password" type="password" required autoComplete="off" spellCheck={false} placeholder="abcd efgh ijkl mnop" className={`${field} font-mono`} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Sender name (optional)</span>
          <input {...bind("name")} maxLength={100} placeholder="Your name" className={field} />
        </label>
        {alias ? (
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">Google account you sign in with</span>
            <input {...bind("login")} type="email" placeholder="you@main-domain.com" className={`${field} font-mono`} />
          </label>
        ) : (
          <button type="button" onClick={() => setAlias(true)} className="self-end text-left text-xs text-muted underline-offset-2 hover:underline">
            Is this address an alias of another Google account?
          </button>
        )}
      </div>

      {result && !result.ok && <p role="alert" className="text-[#e5795b]">{result.error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <button disabled={connecting} className={buttonClass("primary")}>{connecting ? "Checking with Gmail…" : "Connect"}</button>
        <button type="button" onClick={onCancel} className={buttonClass("ghost")}>Cancel</button>
        {oauth && (
          <button formAction={connectGmail} formNoValidate className={`${buttonClass("ghost")} ml-auto`}>
            Use Google&apos;s consent page instead
          </button>
        )}
      </div>
    </form>
  );
}
