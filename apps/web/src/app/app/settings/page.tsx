import { KeyRound, Mail } from "lucide-react";
import { connectGmail } from "@/app/app/actions";
import { buttonClass, Card, PageHeader, Pill } from "@/components/app/ui";
import { load } from "@/lib/meerko";

export default async function SettingsPage() {
  const [mailboxes, credits, keys] = await load((c) => Promise.all([c.listMailboxes(), c.getCredits(), c.listProviderKeys()]));
  return (
    <div className="flex max-w-4xl flex-col gap-6 px-8 py-7">
      <PageHeader eyebrow="Settings" title="Mailboxes & keys" />

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold"><Mail className="size-4 text-accent" />Mailboxes</h2>
          <form action={connectGmail}>
            <button className={buttonClass("primary")}>Connect Gmail</button>
          </form>
        </div>
        {mailboxes.length === 0 && <p className="px-5 py-6 text-[13px] text-muted">Connect the Gmail or Google Workspace inbox you send from.</p>}
        {mailboxes.map((m) => (
          <div key={m.id} className="flex flex-wrap items-center gap-4 border-b border-line px-5 py-4 last:border-0">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-mono text-[13px]">{m.email}</span>
              {m.lastError && <span className="text-xs text-[#e5795b]">{m.lastError}</span>}
            </span>
            <span className="font-mono text-xs text-muted">{m.dailyLimit}/day</span>
            <Pill tone={m.status === "active" ? "signal" : "neutral"}>{m.status === "active" ? "connected" : "reconnect"}</Pill>
            {m.status === "error" && (
              <form action={connectGmail}>
                <button className={buttonClass()}>Reconnect</button>
              </form>
            )}
          </div>
        ))}
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold"><KeyRound className="size-4 text-accent" />Credits & provider keys</h2>
        </div>
        <div className="flex flex-col gap-3 px-5 py-4 text-[13px]">
          <p>
            {credits.enabled ? (
              <>Balance: <span className="font-mono">{(credits.balance ?? 0).toLocaleString("en")} credits</span>. Found emails cost 8, verifications 1, search results 1. Misses are free.</>
            ) : (
              "Credits are off on this install: searches and enrichment use your own provider keys."
            )}
          </p>
          {keys.length === 0 ? (
            <p className="text-muted">No provider keys. Add your own Icypeas key to skip credits: <span className="font-mono text-fg">meerko keys set icypeas &lt;key&gt;</span></p>
          ) : (
            keys.map((k) => (
              <p key={k.provider} className="font-mono text-xs">
                {k.provider} · …{k.last4} <span className="text-muted">(no credits charged)</span>
              </p>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
