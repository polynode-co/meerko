import { ArrowLeftRight, Check, X } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MeerkoApiError, MeerkoClient } from "@meerko/sdk";
import { Logo, LogoMark } from "@/components/ui/brand";
import { apiUrl, SESSION_COOKIE } from "@/lib/meerko";
import { decide } from "./actions";

export const metadata: Metadata = { title: "Connect an app — Meerko", robots: { index: false } };

// What an approved app can and can't do, as enforced by the API (apps never get a dashboard session).
const can = ["Find and enrich leads, and manage your tables", "Create and run sequences that send from your connected mailboxes", "Read replies, and draft and send answers"];
const cannot = ["create API keys or connect other apps"];

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center gap-10 px-5 py-10">
      <a href="/" aria-label="Meerko home">
        <Logo size={30} className="text-[22px]" />
      </a>
      <div className="flex w-full max-w-[460px] flex-col gap-6 rounded-2xl border border-line bg-raised p-7">{children}</div>
    </main>
  );
}

function Problem({ title, body }: { title: string; body: React.ReactNode }) {
  return (
    <Shell>
      <h1 className="font-display text-2xl font-bold">{title}</h1>
      <div className="leading-[1.55] text-muted">{body}</div>
    </Shell>
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
  let email: string | null;
  try {
    const [described, me] = await Promise.all([client.describeOAuthRequest(request), client.me()]);
    info = described;
    email = me.user?.email ?? null;
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
              <a href="/docs/claude-code" className="text-accent hover:underline">how</a>).
            </>
          }
        />
      );
    }
    return <Problem title="Can't connect this app" body={err.message} />;
  }

  return (
    <Shell>
      <div className="flex items-center justify-center gap-3">
        <span className="grid size-12 place-items-center rounded-xl bg-ink">
          <LogoMark size={32} />
        </span>
        <ArrowLeftRight className="size-4 text-muted" />
        <span className="grid size-12 place-items-center rounded-xl border border-line bg-ink font-display text-lg font-bold text-fg">
          {info.client_name.slice(0, 1).toUpperCase()}
        </span>
      </div>
      <div className="flex flex-col gap-2 text-center">
        <h1 className="font-display text-[26px] leading-tight font-bold">
          <span className="text-accent">{info.client_name}</span> wants to use your Meerko workspace
        </h1>
        <p className="text-sm text-muted">
          {info.workspace}
          {email && <> · signed in as {email}</>}
        </p>
      </div>

      {error && (
        <p role="alert" className="text-[13px] text-[#e5795b]">
          {error}
        </p>
      )}

      <ul className="flex flex-col gap-2.5 border-y border-line py-5 text-[15px]">
        {can.map((t) => (
          <li key={t} className="flex gap-2.5">
            <Check className="mt-[3px] size-4 shrink-0 text-signal" /> {t}
          </li>
        ))}
        {cannot.map((t) => (
          <li key={t} className="flex gap-2.5 text-muted">
            <X className="mt-[3px] size-4 shrink-0" /> It can&apos;t {t}
          </li>
        ))}
      </ul>

      <p className="text-[13px] leading-normal text-muted">
        Only allow apps you started connecting yourself. You&apos;ll be sent back to <span className="font-mono text-fg">{info.redirect_to}</span>.
        Disconnect it any time in <a href="/app/settings" className="text-accent hover:underline">Settings</a>.
      </p>

      <form action={decide} className="flex gap-3">
        <input type="hidden" name="request" value={request} />
        <button name="decision" value="deny" className="flex-1 rounded-[10px] border border-line px-5 py-3 font-semibold hover:border-muted">
          Cancel
        </button>
        <button name="decision" value="allow" className="flex-1 rounded-[10px] bg-accent px-5 py-3 font-semibold text-dark hover:brightness-110">
          Allow
        </button>
      </form>
    </Shell>
  );
}
