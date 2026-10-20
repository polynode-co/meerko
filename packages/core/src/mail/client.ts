import type { mailboxes } from "@meerko/db";
import type { SecretBox } from "../provider-keys.ts";
import { GmailClient, GmailError, type GmailMessage, type GoogleOAuth } from "./gmail.ts";
import { GmailImapClient, type ImapConnectors } from "./gmail-imap.ts";

/** A built MIME message and what the SMTP envelope needs (the Gmail API reads them from the message). */
export interface OutgoingRaw {
  raw: string;
  /** The Message-ID header in `raw`, used to find the sent copy over IMAP. */
  messageId: string;
  from: string;
  to: string;
}

/** Gmail ids of a sent message. Null when IMAP couldn't find the sent copy yet (the reply tick fills them in). */
export interface SentIds {
  id: string | null;
  threadId: string | null;
}

/** What sending and reply detection need from a mailbox, whichever way it's connected. */
export interface MailClient {
  /** Sends the message. Pass `threadId` to keep follow-ups in the sender's thread (the API needs it; IMAP threads by headers). */
  send(email: OutgoingRaw, threadId?: string): Promise<SentIds>;
  /** Message ids matching a Gmail search query (e.g. `after:1759650000 -from:me`), up to `max`. */
  listMessageIds(q: string, max?: number): Promise<{ id: string; threadId: string }[]>;
  /** `metadata` returns only the requested headers (cheap); `full` includes the body. */
  getMessage(id: string, format?: "full" | "metadata", metadataHeaders?: string[]): Promise<GmailMessage>;
  /** Looks up a sent message's Gmail ids by its Message-ID. Only IMAP needs it, after a send it couldn't resolve. */
  findByMessageId?(rfcMessageId: string): Promise<SentIds>;
  close(): Promise<void>;
}

export interface MailDeps {
  box: SecretBox;
  /** Needed only for mailboxes connected through the Gmail API. */
  oauth?: GoogleOAuth;
  fetch?: typeof fetch;
  /** Overrides the IMAP and SMTP connections (tests). */
  imap?: ImapConnectors;
}

type Mailbox = Pick<typeof mailboxes.$inferSelect, "provider" | "email" | "login" | "encryptedRefreshToken" | "encryptedPassword">;

/** The client for a stored mailbox, decrypting its credential. Close it when done. */
export function mailClient(mailbox: Mailbox, deps: MailDeps): MailClient {
  if (mailbox.provider === "gmail_imap") {
    if (!mailbox.encryptedPassword) throw new GmailError("This mailbox has no app password; connect it again", undefined, true);
    return new GmailImapClient({ email: mailbox.email, login: mailbox.login ?? mailbox.email, password: deps.box.decrypt(mailbox.encryptedPassword) }, deps.imap);
  }
  // Without OAuth configured the mailbox can't be used until it's reconnected, e.g. with an app password.
  if (!deps.oauth) throw new GmailError("Gmail sign-in isn't configured on this server; connect the mailbox with an app password", undefined, true);
  if (!mailbox.encryptedRefreshToken) throw new GmailError("This mailbox has no Google token; connect it again", undefined, true);
  return new GmailClient(deps.oauth, deps.box.decrypt(mailbox.encryptedRefreshToken), deps.fetch);
}
