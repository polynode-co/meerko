// Test helper: Microsoft's token endpoint and a Graph mailbox (Sent Items and Inbox) behind fetch.
type Stored = { id: string; folder: "inbox" | "sentitems"; mime: string; receivedDateTime: string; from: string; to: string[] };

const header = (mime: string, name: string) =>
  mime
    .split(/\r?\n\r?\n/)[0]!
    .replace(/\r?\n[ \t]+/g, " ")
    .split(/\r?\n/)
    .find((l) => l.toLowerCase().startsWith(`${name.toLowerCase()}:`))
    ?.slice(name.length + 1)
    .trim();
const address = (v = "") => (v.match(/<([^>]+)>/)?.[1] ?? v).trim().toLowerCase();

export function fakeGraph(opts: { me?: string; rewriteMessageId?: boolean; revoked?: boolean; noMailbox?: boolean; unlicensed?: boolean; rotate?: boolean } = {}) {
  const me = opts.me ?? "ana@acme.com";
  const store: Stored[] = [];
  const calls: { method: string; url: string }[] = [];
  let tokens = 0;
  const graphMessage = (m: Stored) => ({
    id: m.id,
    internetMessageId: header(m.mime, "Message-ID"),
    subject: header(m.mime, "Subject"),
    receivedDateTime: m.receivedDateTime,
    sentDateTime: m.receivedDateTime,
    from: { emailAddress: { address: m.from } },
    toRecipients: m.to.map((a) => ({ emailAddress: { address: a } })),
    internetMessageHeaders: m.mime
      .split(/\r?\n\r?\n/)[0]!
      .replace(/\r?\n[ \t]+/g, " ")
      .split(/\r?\n/)
      .map((l) => ({ name: l.slice(0, l.indexOf(":")), value: l.slice(l.indexOf(":") + 1).trim() })),
  });

  const fetch = (async (input: string, init?: RequestInit) => {
    const url = new URL(input);
    calls.push({ method: init?.method ?? "GET", url: input });
    if (url.host === "login.microsoftonline.com") {
      const body = new URLSearchParams(String(init!.body));
      if (opts.revoked && body.get("grant_type") === "refresh_token") return Response.json({ error: "invalid_grant", error_description: "AADSTS70000: revoked" }, { status: 400 });
      tokens++;
      return Response.json({
        access_token: `at-${tokens}`,
        expires_in: 3600,
        scope: "openid email profile User.Read Mail.Send Mail.Read",
        refresh_token: body.get("grant_type") === "authorization_code" ? "rt-1" : opts.rotate ? `rt-new-${tokens}` : body.get("refresh_token"),
      });
    }
    const path = url.pathname.replace("/v1.0/me", "");
    if (opts.noMailbox && path !== "") return Response.json({ error: { code: "MailboxNotEnabledForRESTAPI", message: "REST API is not yet supported for this mailbox." } }, { status: 404 });
    if (path === "") return Response.json({ id: "u1", mail: null, userPrincipalName: me.toUpperCase() });
    // An account without an Exchange Online license: Graph answers mail calls with a bare 401.
    if (opts.unlicensed) return new Response(null, { status: 401 });
    if (path === "/mailFolders/inbox") return Response.json({ id: "inbox" });
    if (path === "/sendMail") {
      let mime = Buffer.from(String(init!.body), "base64").toString();
      if (opts.rewriteMessageId) mime = mime.replace(/^Message-ID: .*$/m, `Message-ID: <exch-${store.length}@outlook.com>`);
      store.push({ id: `g${store.length}`, folder: "sentitems", mime, receivedDateTime: new Date().toISOString(), from: me, to: [address(header(mime, "To"))] });
      return new Response(null, { status: 202 });
    }
    const raw = path.match(/^\/messages\/([^/]+)\/\$value$/);
    if (raw) return new Response(store.find((m) => m.id === raw[1])!.mime);
    const folder = path.match(/^\/mailFolders\/(inbox|sentitems)\/messages$/)?.[1] ?? (path === "/messages" ? "all" : null);
    if (folder) {
      const filter = url.searchParams.get("$filter") ?? "";
      const byId = filter.match(/^internetMessageId eq '(.+)'$/)?.[1];
      const since = filter.match(/^receivedDateTime ge (.+)$/)?.[1];
      let list = store.filter((m) => folder === "all" || m.folder === folder);
      if (byId) list = list.filter((m) => header(m.mime, "Message-ID") === byId);
      if (since) list = list.filter((m) => m.receivedDateTime >= since);
      list = [...list].reverse();
      const top = Number(url.searchParams.get("$top") ?? 100);
      const skip = Number(url.searchParams.get("$skip") ?? 0);
      const page = list.slice(skip, skip + top);
      const next = skip + top < list.length ? (() => { const n = new URL(input); n.searchParams.set("$skip", String(skip + top)); return n.toString(); })() : undefined;
      return Response.json({ value: page.map(graphMessage), ...(next ? { "@odata.nextLink": next } : {}) });
    }
    return Response.json({ error: { code: "NotFound", message: path } }, { status: 404 });
  }) as typeof globalThis.fetch;

  return {
    fetch,
    calls,
    store,
    deliver: (mime: string, at = new Date()) =>
      store.push({ id: `g${store.length}`, folder: "inbox", mime, receivedDateTime: at.toISOString(), from: address(header(mime, "From")), to: [me] }),
  };
}
