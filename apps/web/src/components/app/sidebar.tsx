"use client";

import { Bot, Inbox, LayoutDashboard, LogOut, Menu, Plug, Send, Settings, Sparkles, Table2, X } from "lucide-react";
import Link from "next/link";
import posthog from "posthog-js";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LogoMark } from "@/components/ui/brand";
import { logout } from "@/app/app/actions";
import type { Workspace } from "@meerko/sdk";
import { WorkspaceSwitcher } from "@/components/app/workspace-switcher";

// "WS3/Sidebar" (UG9by) in docs/design/meerko.pen. Below `lg` it folds into a top bar with a menu.

/**
 * Forget the signed-in person, keep the visitor's cookie answer. reset() also clears the stored answer, which drops
 * an accepted visitor back to cookieless and makes the banner ask again (seen on Antwork with the same posthog-js);
 * signing out isn't a cookie answer, so it goes straight back. reset() clears `app_user_id` with the other super
 * properties. The internal-browser flag lives outside PostHog (lib/internal-visitor.ts) and stays.
 */
function signOutOfPostHog() {
  if (!posthog.__loaded) return;
  const consent = posthog.get_explicit_consent_status();
  posthog.reset();
  if (consent === "granted") posthog.opt_in_capturing({ captureEventName: false });
  else if (consent === "denied") posthog.opt_out_capturing();
}

const nav = [
  { href: "/app", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/app/inbox", label: "Inbox", icon: Inbox, badge: "inbox" as const },
  { section: "Outbound" },
  { href: "/app/leads", label: "Leads", icon: Table2 },
  { href: "/app/sequences", label: "Sequences", icon: Send },
  { href: "/app/autopilot", label: "Autopilot", icon: Bot },
  { section: "Workspace" },
  { href: "/app/settings", label: "Connections", icon: Plug },
  { href: "/app/workspace", label: "Settings", icon: Settings },
] as const;

export interface SidebarProps {
  workspace: string;
  workspaces: (Workspace & { current: boolean })[];
  /** Null when signed in with an API key (self-hosting). */
  userEmail: string | null;
  mailboxNeedsReconnect: boolean;
  inboxCount: number;
  credits: { enabled: boolean; balance: number | null };
}

export function Sidebar({ workspace, workspaces, userEmail, mailboxNeedsReconnect, inboxCount, credits }: SidebarProps) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  // Close the mobile menu after navigating.
  useEffect(() => setOpen(false), [path]);
  const active = (href: string, exact?: boolean) => (exact ? path === href : path === href || path.startsWith(href + "/"));

  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-lk-line bg-white px-4 py-2.5 lg:hidden">
        <Link href="/app" className="flex items-center gap-2">
          <LogoMark size={24} />
          <span className="text-[14px] font-semibold text-lk-fg">{workspace}</span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          className="flex items-center gap-2 rounded-md border border-lk-line p-2 text-lk-muted"
        >
          {open ? <X className="size-4" /> : <Menu className="size-4" />}
          {!open && inboxCount > 0 && <span className="rounded-full bg-ws-acc px-1.5 font-mono text-[10px] font-semibold text-lk-fg">{inboxCount}</span>}
        </button>
      </div>
      {open && <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setOpen(false)} />}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[256px] shrink-0 flex-col overflow-y-auto border-r border-lk-line bg-ws-side transition-transform lg:sticky lg:top-0 lg:z-auto lg:h-dvh lg:w-[240px] lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-[52px] shrink-0 items-center border-b border-lk-line px-2">
          <div className="min-w-0 flex-1">
            <WorkspaceSwitcher
              workspace={workspace}
              workspaces={workspaces}
              canCreate={!!userEmail}
              warning={mailboxNeedsReconnect ? "Mailbox needs reconnecting" : null}
            />
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-px p-2 pt-2.5">
          <Link
            href="/docs/quick-start"
            className="mb-2 flex h-8 items-center gap-2 rounded-md border border-lk-line bg-white px-2.5 text-[13px] text-lk-dim transition hover:text-lk-fg"
          >
            <Sparkles className="size-3.5 text-ws-acc-ink" />
            <span className="flex-1">Connect your agent</span>
            <span className="font-mono text-[10px]">MCP</span>
          </Link>
          {nav.map((n) => {
            if ("section" in n)
              return (
                <span key={n.section} className="px-2 pt-3.5 pb-1 font-mono text-[10.5px] tracking-[0.9px] text-lk-dim uppercase">
                  {n.section}
                </span>
              );
            const on = active(n.href, "exact" in n ? n.exact : false);
            const badge = "badge" in n ? inboxCount : 0;
            const Icon = n.icon;
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={on ? "page" : undefined}
                className={`flex h-[30px] items-center gap-2.5 rounded-md px-2 text-[13.5px] transition ${on ? "bg-[#efebe2] font-semibold text-lk-fg" : "text-lk-fg hover:bg-ws-soft"}`}
              >
                <Icon className={`size-4 shrink-0 ${on ? "text-lk-fg" : "text-[#777]"}`} />
                <span className="flex-1">{n.label}</span>
                {badge > 0 && <span className="rounded-full bg-ws-acc px-[5px] font-mono text-[10px] leading-4 font-semibold text-lk-fg">{badge}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="flex flex-col gap-2.5 border-t border-lk-line p-3">
          <Link href="/app/workspace#billing" className="flex flex-col gap-1.5 rounded-lg border border-lk-line bg-white p-2.5 transition hover:border-lk-gray">
            <span className="flex items-center justify-between">
              <span className="font-mono text-[10px] tracking-[1px] text-lk-dim uppercase">Credits</span>
              <span className="font-mono text-[12px] font-semibold text-lk-fg">{credits.enabled ? (credits.balance ?? 0).toLocaleString("en") : "your keys"}</span>
            </span>
            {credits.enabled && (
              <span className="h-1 overflow-hidden rounded-full bg-ws-soft">
                <span className="block h-full bg-ws-acc" style={{ width: `${Math.min(100, ((credits.balance ?? 0) / 1000) * 100)}%` }} />
              </span>
            )}
          </Link>
          <div className="flex items-center justify-between gap-2 px-1">
            <span className="truncate font-mono text-[10.5px] text-lk-dim" title={userEmail ?? undefined}>
              {userEmail ?? "API key"}
            </span>
            {/* reset() so whoever signs in next on this browser isn't merged into this person. */}
            <form action={logout} onSubmit={signOutOfPostHog}>
              <button aria-label="Sign out" title="Sign out" className="rounded p-1 text-lk-dim hover:bg-ws-soft hover:text-lk-fg">
                <LogOut className="size-3.5" />
              </button>
            </form>
          </div>
        </div>
      </aside>
    </>
  );
}
