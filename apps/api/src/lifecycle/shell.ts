/**
 * The two layouts lifecycle emails use, rendered from one list of blocks into HTML and plain text, so the two can't
 * say different things.
 *
 * - `ikerNote`: a plain 1:1 note from Iker. No logo, no band, a signature; replies reach him. For the welcome and the
 *   activation nudges. It is byte for byte the layout the onboarding workflow already sends, so bringing those emails
 *   into git changed nothing that goes out.
 * - `meerkoNotice`: Meerko's branded card (the digest's and the sign-in email's look), one button, and a footer that
 *   says why it came, with PostHog's unsubscribe link. For product notifications.
 *
 * Text is escaped for HTML (`&`, `<`, `>` only, so Liquid and quotes pass through untouched); Liquid tags are filled in
 * by PostHog at send.
 */

export type Block = { p: string } | { button: string; href: string };

export const p = (text: string): Block => ({ p: text });
export const button = (label: string, href: string): Block => ({ button: label, href });

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const attr = (s: string) => esc(s).replace(/"/g, "&quot;");

/** Greets by first name, or "there" when PostHog has no name for the person. */
export const HI = "Hi {{ person.properties.name | split: ' ' | first | default: 'there' }},";

/** PostHog's per-recipient unsubscribe link. */
export const UNSUBSCRIBE_URL = "{{ unsubscribe_url }}";

export const APP_URL = "https://meerko.ai/app";
export const SETTINGS_URL = `${APP_URL}/settings`;

const textOf = (blocks: Block[]) => blocks.map((b) => ("p" in b ? b.p : `${b.button}: ${b.href}`));

export function ikerNote(blocks: Block[]): { html: string; text: string } {
  const body = blocks
    .map((b) =>
      "p" in b
        ? `<p>${esc(b.p)}</p>`
        : `<p><a href="${attr(b.href)}" style="display:inline-block;background:#0b0b0c;color:#ffffff;padding:10px 16px;text-decoration:none;font-weight:600">${esc(b.button)}</a></p>`,
    )
    .join("");
  return {
    html: `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.6;color:#0b0b0c;max-width:560px">${body}<p>Iker<br>Founder, Meerko</p></div>`,
    text: [...textOf(blocks), "Iker\nFounder, Meerko"].join("\n\n"),
  };
}

export function meerkoNotice(input: { headline: string; blocks: Block[]; why: string }): { html: string; text: string } {
  const body = input.blocks
    .map((b) =>
      "p" in b
        ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.6">${esc(b.p)}</p>`
        : `<p style="margin:8px 0 24px"><a href="${attr(b.href)}" style="display:inline-block;background:#0b0b0c;color:#a8f326;padding:13px 20px;font-size:14px;font-weight:600;text-decoration:none">${esc(b.button)}</a></p>`,
    )
    .join("");
  // PostHog's unsubscribe link is the only switch for these: Settings > Notifications covers the digest, not them.
  const footer = `${esc(input.why)} <a href="${attr(UNSUBSCRIBE_URL)}" style="color:#6b6b63">Unsubscribe from these emails</a>.`;
  return {
    html:
      `<div style="margin:0;padding:32px 16px;background:#f6f6f3;font-family:system-ui,-apple-system,sans-serif;color:#0b0b0c">` +
      `<div style="max-width:520px;margin:0 auto;background:#ffffff;padding:32px;border:1px solid #e3e3dc">` +
      `<p style="margin:0 0 20px;font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#6b6b63">Meerko</p>` +
      `<h1 style="margin:0 0 16px;font-size:22px;line-height:1.25">${esc(input.headline)}</h1>` +
      body +
      `<p style="margin:0;font-size:13px;line-height:1.6;color:#6b6b63">${footer}</p>` +
      `</div></div>`,
    text: [
      input.headline,
      ...textOf(input.blocks),
      input.why,
      `Unsubscribe from these emails: ${UNSUBSCRIBE_URL}`,
    ].join("\n\n"),
  };
}
