// Test helper: a fake mail provider behind IMAP and SMTP, with an INBOX and a Sent folder.
import type { ImapConnectors } from "./imap-common.ts";

type Stored = { uid: number; source: string; internalDate: Date };

export function fakeImap(opts: { authFails?: boolean; filesSent?: boolean; address?: string; noSentFolder?: boolean } = {}) {
  const folders: Record<string, Stored[]> = { INBOX: [], Sent: [] };
  const outbox: { envelope: { from: string; to: string[] }; raw: string }[] = [];
  const appended: { path: string; flags?: string[] }[] = [];
  const connectedTo: { kind: string; host: string; port: number; address?: string }[] = [];
  let selected = "INBOX";
  const authError = Object.assign(new Error("AUTHENTICATIONFAILED"), { authenticationFailed: true });

  const store = (path: string, source: string, internalDate = new Date("2027-06-07T09:00:00Z")) => {
    const list = folders[path]!;
    list.push({ uid: list.length + 1, source, internalDate });
  };
  const headerOf = (source: string, name: string) =>
    source
      .split(/\r?\n\r?\n/)[0]!
      .replace(/\r?\n[ \t]+/g, " ")
      .split(/\r?\n/)
      .find((l) => l.toLowerCase().startsWith(`${name.toLowerCase()}:`))
      ?.slice(name.length + 1)
      .trim();
  const fetched = (m: Stored, query: { source?: boolean; headers?: boolean | string[]; envelope?: boolean }) => {
    const names = Array.isArray(query.headers) ? query.headers : [];
    const from = headerOf(m.source, "From")?.match(/<([^>]+)>/)?.[1] ?? headerOf(m.source, "From");
    return {
      seq: m.uid,
      uid: m.uid,
      internalDate: m.internalDate,
      ...(query.envelope ? { envelope: { from: from ? [{ address: from }] : [] } } : {}),
      ...(query.source ? { source: Buffer.from(m.source) } : {}),
      ...(query.headers
        ? { headers: Buffer.from(names.map((n) => (headerOf(m.source, n) !== undefined ? `${n}: ${headerOf(m.source, n)}` : "")).filter(Boolean).join("\r\n")) }
        : {}),
    };
  };

  const connectors: ImapConnectors = {
    sleep: async () => {},
    resolve: async () => [opts.address ?? "203.0.113.10"],
    smtp: (_auth, server) => {
      connectedTo.push({ kind: "smtp", ...server });
      return {
        verify: async () => {
          if (opts.authFails) throw Object.assign(new Error("535 Authentication failed"), { code: "EAUTH", responseCode: 535 });
          return true;
        },
        sendMail: async (mail) => {
          if (opts.authFails) throw Object.assign(new Error("535"), { code: "EAUTH", responseCode: 535 });
          outbox.push(mail);
          if (opts.filesSent) store("Sent", mail.raw);
          return {};
        },
        close: () => {},
      };
    },
    imap: (_auth, server) => {
      connectedTo.push({ kind: "imap", ...server });
      return {
        capabilities: new Map(),
        on: () => {},
        connect: async () => {
          if (opts.authFails) throw authError;
        },
        logout: async () => {},
        list: async () => [{ path: "INBOX", specialUse: "\\Inbox" }, ...(opts.noSentFolder ? [] : [{ path: "Sent", specialUse: "\\Sent" }])],
        mailboxOpen: async (path: string) => {
          selected = path;
          return {};
        },
        noop: async () => {},
        search: async (q: { since?: Date; header?: Record<string, string> }) => {
          const list = folders[selected]!;
          if (q.header) return list.filter((m) => headerOf(m.source, "Message-ID") === q.header!["message-id"]).map((m) => m.uid);
          return list.filter((m) => !q.since || m.internalDate >= q.since).map((m) => m.uid);
        },
        fetch: async function* (uids: number[], query: object) {
          for (const m of folders[selected]!.filter((x) => uids.includes(x.uid))) yield fetched(m, query);
        },
        fetchOne: async (uid: string, query: object) => {
          const m = folders[selected]!.find((x) => x.uid === Number(uid));
          return m ? fetched(m, query) : false;
        },
        append: async (path: string, content: string | Buffer, flags?: string[]) => {
          appended.push({ path, flags });
          store(path, content.toString());
          return { destination: path };
        },
      } as unknown as ReturnType<ImapConnectors["imap"]>;
    },
  };
  return { connectors, folders, outbox, appended, connectedTo, deliver: (source: string, at?: Date) => store("INBOX", source, at) };
}
