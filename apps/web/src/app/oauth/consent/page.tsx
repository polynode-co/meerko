import { ArrowLeftRight, ArrowRight, CornerDownLeft, Lock, RefreshCw, Reply, Search, Send, Terminal } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MeerkoApiError, MeerkoClient } from "@meerko/sdk";
import { Window } from "@/components/lookout/kit";
import { LogoMark } from "@/components/ui/brand";
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
    <span className="grid size-14 place-items-center bg-lk-ink">
      {known ? (
        <Image src={known.logo} alt="" width={28} height={28} className={known.mono ? "invert" : ""} />
      ) : /meerko cli/i.test(name) ? (
        <Terminal className="size-6 text-lk-lime" />
      ) : (
        <span className="font-pixel text-[22px] text-lk-lime">{name.slice(0, 1).toUpperCase()}</span>
      )}
    </span>
  );
}

// The .pen design "LK · Connect an app" (TP47K): a paper window on a night vignette.
function Page({ email, request, title = "CONNECT AN APP", children }: { email?: string | null; request?: string; title?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-lk-bg bg-[radial-gradient(ellipse_60%_60%_at_50%_45%,var(--color-lk-frame)_0%,var(--color-lk-bg)_100%)] text-lk-fg">
      <header className="flex items-center justify-between gap-4 px-5 py-6 sm:px-12">
        <a href="/" aria-label="Meerko home" className="flex items-center gap-2.5">
          <LogoMark size={26} />
          <span className="font-pixel text-[16px] tracking-[0.6px] text-lk-fg">MEERKO</span>
        </a>
      </header>
      <main className="flex flex-1 flex-col items-center gap-7 px-5 pt-4 pb-10">
        <Window title={title} className="w-full max-w-[520px]" bodyClassName="flex flex-col gap-5 px-5 py-7 sm:px-7">
          {children}
        </Window>
        {email && request && (
          <form action={switchAccount} className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 font-plex text-[12.5px] tracking-[0.6px] text-lk-dim uppercase">
            <span>
              Signed in as <span className="normal-case">{email}</span>
            </span>
            <span aria-hidden>·</span>
            <input type="hidden" name="request" value={request} />
            <button className="uppercase underline-offset-4 hover:text-lk-fg hover:underline">Not you?</button>
          </form>
        )}
      </main>
      <footer className="flex justify-center gap-6 px-5 pb-7 font-plex text-[12.5px] tracking-[0.6px] text-lk-dim uppercase">
        <a href="/docs/claude-code" className="hover:text-lk-fg">
          How connecting agents works
        </a>
        <a href="/docs" className="hover:text-lk-fg">
          Docs
        </a>
      </footer>
    </div>
  );
}

function Problem({ title, body }: { title: string; body: React.ReactNode }) {
  return (
    <Page title="MEERKO">
      <h1 className="text-[22px] leading-[1.25] font-semibold tracking-[-0.4px] text-lk-ink">{title}</h1>
      <div className="text-[15.5px] leading-[1.6] text-lk-ink/80 [&_a]:font-semibold [&_a]:text-lk-ink [&_a]:underline [&_code]:text-lk-ink">{body}</div>
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
              app the key in an <code className="font-plex">Authorization: Bearer mk_…</code> header instead (
              <a href="/docs/claude-code#other-ways">
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
      <div className="flex items-center gap-3">
        <span className="grid size-14 place-items-center bg-lk-ink">
          <LogoMark size={32} />
        </span>
        <ArrowLeftRight aria-hidden className="size-4 text-lk-gray" />
        <AppTile name={info.client_name} />
      </div>

      <h1 className="text-[22px] leading-[1.25] font-semibold tracking-[-0.4px] text-lk-ink sm:text-[24px]">
        {info.client_name} wants to use your Meerko workspace
      </h1>

      <div className="flex items-center gap-3 px-3 py-2.5 outline outline-1 -outline-offset-1 outline-lk-ink">
        <span className="font-plex text-[12px] tracking-[0.6px] text-lk-gray uppercase">Workspace</span>
        <span className="min-w-0 flex-1 truncate text-right text-[15px] font-semibold text-lk-ink">{info.workspace}</span>
        {user && <span className="bg-lk-ink px-2 py-0.5 font-plex text-[12px] text-lk-paper">{user.role}</span>}
      </div>

      {error && (
        <p role="alert" className="text-[15px] font-semibold text-[#b3261e]">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-3">
        <p className="font-plex text-[12px] tracking-[0.6px] text-lk-gray uppercase">{info.client_name} will be able to</p>
        {abilities.map(({ icon: Icon, title, body }) => (
          <div key={title} className="flex gap-3">
            <span className="mt-0.5 grid size-[22px] shrink-0 place-items-center bg-lk-ink">
              <Icon className="size-3 text-lk-lime" />
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-[15px] font-semibold text-lk-ink">{title}</span>
              <span className="text-[15px] leading-[1.5] text-lk-ink/70">{body}</span>
            </span>
          </div>
        ))}
        <p className="flex items-center gap-2.5 border-t border-lk-ink/20 pt-3 text-[15px] leading-[1.5] text-lk-ink/80">
          <Lock className="size-[15px] shrink-0" /> It can&apos;t create API keys or connect other apps.
        </p>
      </div>

      <div className="flex flex-wrap justify-between gap-x-4 gap-y-1.5 font-plex text-[12px] text-lk-gray">
        <span className="flex min-w-0 items-center gap-1.5 break-all">
          <CornerDownLeft className="size-[13px] shrink-0" /> Returns to {info.redirect_to}
        </span>
        <span className="flex items-center gap-1.5">
          <RefreshCw className="size-[13px]" /> Renews while in use
        </span>
      </div>

      <form action={decide} className="flex gap-2.5">
        <input type="hidden" name="request" value={request} />
        <button
          name="decision"
          value="allow"
          className="flex h-12 flex-1 items-center justify-center gap-2 bg-lk-ink font-plex text-[13px] font-semibold tracking-[0.8px] text-lk-lime uppercase transition hover:brightness-125"
        >
          Allow access <ArrowRight className="size-4" />
        </button>
        <button
          name="decision"
          value="deny"
          className="h-12 flex-1 font-plex text-[13px] tracking-[0.8px] text-lk-ink uppercase outline outline-[1.5px] -outline-offset-[1.5px] outline-lk-ink transition hover:bg-lk-ink/5"
        >
          Cancel
        </button>
      </form>

      <p className="text-[15px] leading-[1.55] text-lk-ink/70">
        Only allow apps you started connecting yourself. Disconnect any time in{" "}
        <a href="/app/settings" className="font-semibold text-lk-ink underline underline-offset-4">
          Connections → Connected apps
        </a>
        .
      </p>
    </Page>
  );
}
