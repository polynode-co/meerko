// Email Meerko itself sends (sign-in links), as opposed to the outreach users send from their own mailboxes.
// Any SMTP server works: MEERKO_SMTP_URL (smtp://user:pass@host:587, or smtps:// for port 465) and
// MEERKO_MAIL_FROM. Unset means Meerko sends no email of its own, and sign-in links aren't offered.
import nodemailer from "nodemailer";

export interface SystemMail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface SystemMailer {
  send(mail: SystemMail): Promise<void>;
}

/** An SMTP mailer from a connection URL, or null when either setting is missing. */
export function smtpMailer(url: string | undefined, from: string | undefined): SystemMailer | null {
  if (!url || !from) return null;
  // Greet the server with the sender's domain: inside a container the hostname is often "localhost", and
  // some relays (Google Workspace's smtp-relay.gmail.com) refuse that greeting with "421 Try again later".
  const transport = nodemailer.createTransport({ url, name: heloName(from) });
  return {
    async send(mail) {
      await transport.sendMail({ from, ...mail });
    },
  };
}

/** The domain of a sender like "Meerko <noreply@meerko.ai>", or undefined to keep nodemailer's default. */
export function heloName(from: string) {
  return from.match(/@([a-z0-9.-]+\.[a-z]{2,})>?\s*$/i)?.[1]?.toLowerCase();
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

/** The sign-in link email: plain text first (it's what most spam filters and screen readers read). */
export function signInLinkMail(to: string, link: string): SystemMail {
  const text = [
    "Here's your link to sign in to Meerko:",
    "",
    link,
    "",
    "It works once and expires in 15 minutes.",
    "If you didn't ask for it, ignore this email: nobody can sign in without the link.",
  ].join("\n");
  const html = `<!doctype html><html><body style="margin:0;padding:32px 16px;background:#f6f6f3;font-family:system-ui,-apple-system,sans-serif;color:#0b0b0c">
<div style="max-width:440px;margin:0 auto;background:#fff;padding:32px;border:1px solid #e3e3dc">
<p style="margin:0 0 20px;font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#6b6b63">Meerko</p>
<h1 style="margin:0 0 12px;font-size:22px;line-height:1.25">Sign in to Meerko</h1>
<p style="margin:0 0 24px;font-size:15px;line-height:1.6">Use the button below. It works once and expires in 15 minutes.</p>
<p style="margin:0 0 24px"><a href="${escapeHtml(link)}" style="display:inline-block;background:#0b0b0c;color:#a8f326;padding:13px 20px;font-size:14px;font-weight:600;text-decoration:none">Sign in</a></p>
<p style="margin:0;font-size:13px;line-height:1.6;color:#6b6b63">If you didn't ask for it, ignore this email: nobody can sign in without the link.</p>
</div></body></html>`;
  return { to, subject: "Your Meerko sign-in link", text, html };
}
