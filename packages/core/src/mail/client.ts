import { eq, mailboxes, type Db } from "@meerko/db";
import type { SecretBox } from "../provider-keys.ts";
import { GmailClient, GmailError, type GmailMessage, type GoogleOAuth } from "./gmail.ts";
import { GmailImapClient } from "./gmail-imap.ts";
import { ImapClient } from "./imap.ts";
import { OutlookClient, type MicrosoftOAuth } from "./outlook.ts";
import type { ImapConnectors } from "./imap-common.ts";

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
  /** The Message-ID the provider actually sent with, when it replaced Meerko's (Outlook may). Store this one. */
  rfcMessageId?: string;
}

/** A received message, before its body is fetched. */
export interface InboundRef {
  id: string;
  threadId: string;
  /**
   * Message-IDs it answers (References, In-Reply-To, or the original a bounce quotes). Generic IMAP has no
   * thread ids, so the reply tick matches these against the Message-IDs it sent.
   */
  refs?: string[];
  /**
   * The sender's address, lowercased ("" when it has no From), when the listing read it. With it, the reply tick needs
   * no header fetch for mail outside its threads; the Gmail API lists ids only, so it leaves this out.
   */
  from?: string;
}

/** What sending and reply detection need from a mailbox, whichever way it's connected. */
export interface MailClient {
  /** Sends the message. Pass `threadId` to keep follow-ups in the sender's thread (the API needs it; IMAP threads by headers). */
  send(email: OutgoingRaw, threadId?: string): Promise<SentIds>;
  /** Mail received since `since` that this account didn't send, newest first. */
  listInbound(since: Date): Promise<InboundRef[]>;
  /** `metadata` returns only the requested headers (cheap); `full` includes the body. */
  getMessage(id: string, format?: "full" | "metadata", metadataHeaders?: string[]): Promise<GmailMessage>;
  /** Looks up a sent message's Gmail ids by its Message-ID. Only IMAP needs it, after a send it couldn't resolve. */
  findByMessageId?(rfcMessageId: string): Promise<SentIds>;
  close(): Promise<void>;
  /**
   * Drops the client's connections at once, without signing out, for a server that stopped answering (a sign-out
   * would wait on it too). Commands still waiting on them fail. Clients with no connection to drop leave it out.
   */
  abort?(): void;
}

export interface MailDeps {
  box: SecretBox;
  /** Needed only for mailboxes connected through the Gmail API. */
  oauth?: GoogleOAuth;
  /** Needed only for Outlook / Microsoft 365 mailboxes. */
  microsoft?: MicrosoftOAuth;
  /** Lets an Outlook mailbox store the new refresh token Microsoft issues on each refresh. */
  db?: Db;
  fetch?: typeof fetch;
  /** Overrides the IMAP and SMTP connections (tests). */
  imap?: ImapConnectors;
}

type Mailbox = Pick<typeof mailboxes.$inferSelect, "id" | "provider" | "email" | "login" | "encryptedRefreshToken" | "encryptedPassword" | "servers">;

/** The client for a stored mailbox, decrypting its credential. Close it when done. */
export function mailClient(mailbox: Mailbox, deps: MailDeps): MailClient {
  if (mailbox.provider === "outlook") {
    if (!deps.microsoft) throw new GmailError("Microsoft sign-in isn't configured on this server", undefined, true);
    if (!mailbox.encryptedRefreshToken) throw new GmailError("This mailbox has no Microsoft token; connect it again", undefined, true);
    const { db, box } = deps;
    return new OutlookClient(deps.microsoft, box.decrypt(mailbox.encryptedRefreshToken), {
      email: mailbox.email,
      fetch: deps.fetch,
      // Microsoft rotates refresh tokens; keeping the newest stops the mailbox expiring after 90 days.
      onRefreshToken: db
        ? async (token) => {
            await db.update(mailboxes).set({ encryptedRefreshToken: box.encrypt(token) }).where(eq(mailboxes.id, mailbox.id));
          }
        : undefined,
    });
  }
  if (mailbox.provider === "imap") {
    if (!mailbox.encryptedPassword || !mailbox.servers) throw new GmailError("This mailbox has no password or servers; connect it again", undefined, true);
    const password = deps.box.decrypt(mailbox.encryptedPassword);
    return new ImapClient({ email: mailbox.email, login: mailbox.login ?? mailbox.email, password, servers: mailbox.servers }, deps.imap);
  }
  if (mailbox.provider === "gmail_imap") {
    if (!mailbox.encryptedPassword) throw new GmailError("This mailbox has no app password; connect it again", undefined, true);
    return new GmailImapClient({ email: mailbox.email, login: mailbox.login ?? mailbox.email, password: deps.box.decrypt(mailbox.encryptedPassword) }, deps.imap);
  }
  // Without OAuth configured the mailbox can't be used until it's reconnected, e.g. with an app password.
  if (!deps.oauth) throw new GmailError("Gmail sign-in isn't configured on this server; connect the mailbox with an app password", undefined, true);
  if (!mailbox.encryptedRefreshToken) throw new GmailError("This mailbox has no Google token; connect it again", undefined, true);
  return new GmailClient(deps.oauth, deps.box.decrypt(mailbox.encryptedRefreshToken), deps.fetch);
}
