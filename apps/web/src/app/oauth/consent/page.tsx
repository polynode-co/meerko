import { ArrowRight, Building2, CornerDownLeft, Lock, RefreshCw, Reply, Search, Send, ShieldCheck, Terminal } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MeerkoApiError, MeerkoClient } from "@meerko/sdk";
import { Logo, LogoMark } from "@/components/ui/brand";
import { apiUrl, SESSION_COOKIE } from "@/lib/meerko";
import { decide, switchAccount } from "./actions";

export const metadata: Metadata = { title: "Connect an app — Meerko", robots: { index: false } };

// What an approved app can do, as enforced by the API: apps act on the workspace but never get a
// dashboard session, so they can't manage keys or apps.
const abilities = [
  { icon: Search, title: "Find and enrich leads", body: "Search people and companies, find emails, manage tables" },
  { icon: Send, title: "Run sequences", body: "Create and start sequences that send from your connected mailboxes" },
  { icon: Reply, title: "Work your replies", body: "Read replies, then draft and send answers" },
];

// Logos for apps we recognise by the name they registered with. `mono` marks are black, so inverted.
const knownApps = [
  { match: /claude/i, logo: "/logos/agents/claude.svg" },
  { match: /codex|openai|chatgpt/i, logo: "/logos/agents/openai.svg", mono: true },
  { match: /cursor/i, logo: "/logos/agents/cursor.svg", mono: true },
  { match: /gemini/i, logo: "/logos/agents/gemini.svg" },
  { match: /windsurf/i, logo: "/logos/agents/windsurf.svg", mono: true },
];

function AppTile({ name }: { name: string }) {
  const known = knownApps.find((k) => k.match.test(name));
  return (
    <span className="grid size-16 place-items-center rounded-2xl border border-line bg-ink">
      {known ? (
        <Image src={known.logo} alt="" width={32} height={32} className={known.mono ? "invert" : ""} />
      ) : /meerko cli/i.test(name) ? (
        <Terminal className="size-7 text-accent" />
      ) : (
        <span className="font-display text-2xl font-bold">{name.slice(0, 1).toUpperCase()}</span>
      )}
    </span>
  );
}

function Page({ email, request, children }: { email?: string | null; request?: string; children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute top-[180px] left-1/2 size-[600px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(242,169,59,0.13),transparent)]"
      />
      <header className="relative flex items-center justify-between gap-4 px-5 py-6 sm:px-16 sm:py-7">
        <a href="/" aria-label="Meerko home">
          <Logo size={30} className="text-[22px]" />
        </a>
        {email && request && (
          <form action={switchAccount} className="flex items-center gap-2.5 text-sm">
            <span className="hidden size-7 place-items-center rounded-full bg-accent-soft text-[13px] font-semibold text-accent sm:grid">
              {email.slice(0, 1).toUpperCase()}
            </span>
            <span className="hidden text-muted sm:inline">{email}</span>
            <span className="hidden text-line sm:inline">·</span>
            <input type="hidden" name="request" value={request} />
            <button className="font-semibold hover:text-accent">Not you?</button>
          </form>
        )}
      </header>
      <main className="relative flex flex-1 justify-center px-5 pt-6 pb-10">
        <div className="flex h-fit w-full max-w-[520px] flex-col gap-6 rounded-[20px] border border-line bg-raised px-6 pt-9 pb-8 shadow-[0_24px_60px_rgba(0,0,0,0.4)] sm:px-9">
          {children}
        </div>
      </main>
      <footer className="relative flex justify-center gap-6 px-5 pb-7 text-[13px] text-muted">
        <a href="/docs/claude-code" className="hover:text-fg">
          How connecting agents works
        </a>
        <a href="/docs" className="hover:text-fg">
          Docs
        </a>
      </footer>
    </div>
  );
}

function Problem({ title, body }: { title: string; body: React.ReactNode }) {
  return (
    <Page>
      <h1 className="font-display text-2xl font-bold">{title}</h1>
      <div className="leading-[1.55] text-muted">{body}</div>
    </Page>
  );
}

export default async function ConsentPage({ searchParams }: { searchParams: Promise<{ request?: string; error?: string }> }) {
  const { request, error } = await searchParams;
  if (!request) return <Problem title="Nothing to approve" body="Start connecting from your app (for example, Claude Code's /mcp menu)." />;

  const here = `/oauth/consent?request=${encodeURIComponent(request)}`;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) redirect(`/login?next=${encodeURIComponent(here)}`);

  const client = new MeerkoClient({ apiUrl: apiUrl(), apiKey: token });
  let info: { client_name: string; redirect_to: string; workspace: string };
  let user: { email: string; role: string } | null;
  try {
    const [described, me] = await Promise.all([client.describeOAuthRequest(request), client.me()]);
    info = described;
    user = me.user;
  } catch (err) {
    if (!(err instanceof MeerkoApiError)) throw err;
    if (err.status === 401) redirect(`/login?expired=1&next=${encodeURIComponent(here)}`);
    if (err.status === 403) {
      return (
        <Problem
          title="Sign in with Google to connect apps"
          body={
            <>
              You&apos;re logged in with an API key. Apps connect through a person&apos;s Google sign-in. On a server without Google, give your
              app the key in an <code className="font-mono text-fg">Authorization: Bearer mk_…</code> header instead (
              <a href="/docs/claude-code#other-ways" className="text-accent hover:underline">
                how
              </a>
              ).
            </>
          }
        />
      );
    }
    return <Problem title="Can't connect this app" body={err.message} />;
  }

  return (
    <Page email={user?.email} request={request}>
      <div className="flex items-center justify-center">
        <span className="grid size-16 place-items-center rounded-2xl border border-line bg-ink">
          <LogoMark size={34} />
        </span>
        <span className="relative flex w-[110px] items-center justify-center">
          <span aria-hidden className="absolute inset-x-1.5 top-1/2 border-t-[1.5px] border-dashed border-accent/40" />
          <span className="relative grid size-[30px] place-items-center rounded-full border border-accent/35 bg-raised">
            <ShieldCheck className="size-3.5 text-accent" />
          </span>
        </span>
        <AppTile name={info.client_name} />
      </div>

      <div className="flex flex-col items-center gap-2.5 text-center">
        <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Connect an app</p>
        <h1 className="font-display text-[26px] leading-[1.15] font-bold tracking-[-0.02em] sm:text-[28px]">
          <span className="text-accent">{info.client_name}</span> wants to use your Meerko workspace
        </h1>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-line bg-ink px-3.5 py-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-soft">
          <Building2 className="size-4 text-accent" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-mono text-[10px] tracking-[0.14em] text-muted uppercase">Workspace</span>
          <span className="truncate text-[15px] font-semibold">{info.workspace}</span>
        </span>
        {user && <span className="rounded-full border border-line px-2.5 py-0.5 font-mono text-[11px] text-muted">{user.role}</span>}
      </div>

      {error && (
        <p role="alert" className="text-[13px] text-[#e5795b]">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-3.5">
        <p className="font-mono text-[11px] tracking-[0.14em] text-muted uppercase">{info.client_name} will be able to</p>
        {abilities.map(({ icon: Icon, title, body }) => (
          <div key={title} className="flex gap-3">
            <span className="grid size-[30px] shrink-0 place-items-center rounded-lg bg-accent-soft">
              <Icon className="size-[15px] text-accent" />
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-[15px] font-semibold">{title}</span>
              <span className="text-[13px] leading-[1.45] text-muted">{body}</span>
            </span>
          </div>
        ))}
        <p className="flex items-center gap-3 rounded-[10px] bg-ink px-3 py-2.5 text-[13px] text-muted">
          <Lock className="size-[15px] shrink-0" /> It can&apos;t create API keys or connect other apps.
        </p>
      </div>

      <div className="flex flex-wrap justify-between gap-x-4 gap-y-1.5 border-t border-line pt-5 font-mono text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <CornerDownLeft className="size-[13px]" /> Returns to {info.redirect_to}
        </span>
        <span className="flex items-center gap-1.5">
          <RefreshCw className="size-[13px]" /> Renews while in use
        </span>
      </div>

      <form action={decide} className="flex gap-3">
        <input type="hidden" name="request" value={request} />
        <button name="decision" value="deny" className="h-12 flex-1 rounded-[10px] border border-line font-semibold hover:border-muted">
          Cancel
        </button>
        <button name="decision" value="allow" className="flex h-12 flex-1 items-center justify-center gap-2 rounded-[10px] bg-accent font-bold text-dark hover:brightness-110">
          Allow access <ArrowRight className="size-4" />
        </button>
      </form>

      <p className="text-center text-[12.5px] leading-normal text-muted">
        Only allow apps you started connecting yourself. Disconnect any time in{" "}
        <a href="/app/settings" className="text-accent hover:underline">
          Settings → Connected apps
        </a>
        .
      </p>
    </Page>
  );
}
