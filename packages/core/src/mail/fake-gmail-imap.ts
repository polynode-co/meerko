// Test helper: a fake Gmail account behind IMAP and SMTP.
import type { ImapConnectors } from "./imap-common.ts";

/** A Gmail account over IMAP: messages in All Mail with decimal X-GM ids, and an SMTP outbox. */
export function fakeGmail(opts: { gmail?: boolean; authFails?: boolean; indexAfterLookups?: number; me?: string } = {}) {
  type Stored = { uid: number; emailId: string; threadId: string; messageId: string; source: string; internalDate: Date };
  const all: Stored[] = [];
  const outbox: { envelope: { from: string; to: string[] }; raw: string }[] = [];
  const searches: unknown[] = [];
  let lookups = 0;
  /** Set `indexing` to false to make sent mail unfindable by Message-ID for a while. */
  const state = { indexing: true };
  let loggedOut = false;
  let openedReadOnly = false;
  const authError = Object.assign(new Error("Invalid credentials (Failure)"), { authenticationFailed: true });

  const store = (source: string, threadId?: string) => {
    const uid = all.length + 1;
    const emailId = String(1879569508915794709n + BigInt(uid));
    all.push({ uid, emailId, threadId: threadId ?? emailId, messageId: source.match(/^Message-ID: (.+)$/m)![1]!.trim(), source, internalDate: new Date("2026-10-05T09:00:00Z") });
    return all.at(-1)!;
  };
  const toFetched = (m: Stored, query: { source?: boolean; headers?: boolean | string[] }) => ({
    seq: m.uid,
    uid: m.uid,
    emailId: m.emailId,
    threadId: m.threadId,
    internalDate: m.internalDate,
    ...(query.source ? { source: Buffer.from(m.source) } : {}),
    ...(query.headers ? { headers: Buffer.from(m.source.split("\r\n\r\n")[0]!.split("\r\n").filter((l) => /^from:/i.test(l)).join("\r\n")) } : {}),
  });

  const auths: string[] = [];
  const connectors: ImapConnectors = {
    sleep: async () => {},
    smtp: (auth) => ({
      verify: async () => {
        auths.push(auth.user);
        if (opts.authFails) throw Object.assign(new Error("535 5.7.8 Username and Password not accepted"), { code: "EAUTH", responseCode: 535 });
        return true;
      },
      sendMail: async (mail) => {
        auths.push(auth.user);
        if (opts.authFails) throw Object.assign(new Error("535 5.7.8"), { code: "EAUTH", responseCode: 535 });
        outbox.push(mail);
        // Gmail threads a follow-up with the message it answers.
        const inReplyTo = mail.raw.match(/^In-Reply-To: (.+)$/m)?.[1]?.trim();
        store(mail.raw, all.find((m) => m.messageId === inReplyTo)?.threadId);
        return {};
      },
      close: () => {},
    }),
    imap: () =>
      ({
        capabilities: new Map([["X-GM-EXT-1", true]].filter(() => opts.gmail !== false) as [string, boolean][]),
        on: () => {},
        connect: async () => {
          if (opts.authFails) throw authError;
        },
        logout: async () => {
          loggedOut = true;
        },
        list: async () => [{ path: "[Gmail]/All Mail", specialUse: "\\All" }, { path: "INBOX", specialUse: "\\Inbox" }],
        mailboxOpen: async (_path: string, o?: { readOnly?: boolean }) => {
          openedReadOnly = !!o?.readOnly;
          return {};
        },
        noop: async () => {},
        search: async (q: { gmraw?: string; emailId?: string }) => {
          searches.push(q);
          if (q.emailId) return all.filter((m) => m.emailId === q.emailId).map((m) => m.uid);
          const byId = q.gmraw?.match(/^rfc822msgid:(.+)$/)?.[1];
          if (byId) {
            if (++lookups <= (opts.indexAfterLookups ?? 0) || state.indexing === false) return [];
            return all.filter((m) => m.messageId === `<${byId}>`).map((m) => m.uid);
          }
          // Only "-from:me" queries are used: everything not sent from the account.
          const me = opts.me ?? "iker@meerko.ai";
          return all.filter((m) => !new RegExp(`^From:.*${me}`, "mi").test(m.source)).map((m) => m.uid);
        },
        fetchOne: async (uid: string, query: { source?: boolean; headers?: boolean | string[] }) => {
          const m = all.find((x) => x.uid === Number(uid));
          return m ? toFetched(m, query) : false;
        },
        fetch: async function* (uids: number[], query: object) {
          for (const m of all.filter((x) => uids.includes(x.uid))) yield toFetched(m, query);
        },
      }) as unknown as ReturnType<ImapConnectors["imap"]>,
  };
  return {
    state,
    all,
    auths,
    connectors,
    outbox,
    searches,
    store,
    get loggedOut() {
      return loggedOut;
    },
    get openedReadOnly() {
      return openedReadOnly;
    },
  };
}

