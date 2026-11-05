"use client";

import { Inbox, LayoutDashboard, LogOut, Menu, PanelsTopLeft, Plug, Send, X } from "lucide-react";
import Link from "next/link";
import posthog from "posthog-js";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LogoMark } from "@/components/ui/brand";
import { logout } from "@/app/app/actions";
import type { Workspace } from "@meerko/sdk";
import { WorkspaceSwitcher } from "@/components/app/workspace-switcher";

// The "LK App Sidebar" component (pQPbg) from the .pen file. Below `lg` it folds into a top bar with a menu.

const nav = [
  { href: "/app", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/app/leads", label: "Leads", icon: PanelsTopLeft },
  { href: "/app/sequences", label: "Sequences", icon: Send },
  { href: "/app/inbox", label: "Inbox", icon: Inbox, badge: "inbox" as const },
  { href: "/app/settings", label: "Connections", icon: Plug },
];

export interface SidebarProps {
  workspace: string;
  workspaces: (Workspace & { current: boolean })[];
  /** Null when signed in with an API key (self-hosting). */
  userEmail: string | null;
  mailboxNeedsReconnect: boolean;
  inboxCount: number;
  credits: { enabled: boolean; balance: number | null };
}

const Brand = () => (
  <Link href="/app" className="flex items-center gap-2.5 px-2">
    <LogoMark size={26} />
    <span className="font-pixel text-[16px] tracking-[1px] text-lk-fg">MEERKO</span>
  </Link>
);

export function Sidebar({ workspace, workspaces, userEmail, mailboxNeedsReconnect, inboxCount, credits }: SidebarProps) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  // Close the mobile menu after navigating.
  useEffect(() => setOpen(false), [path]);
  const active = (href: string, exact?: boolean) => (exact ? path === href : path === href || path.startsWith(href + "/"));

  const item = (href: string, label: string, Icon: typeof Inbox, on: boolean, badge?: number) => (
    <Link
      key={href}
      href={href}
      aria-current={on ? "page" : undefined}
      className={`flex items-center gap-3 p-2.5 font-plex text-[13px] tracking-[0.6px] uppercase transition ${
        on ? "bg-lk-lime font-semibold text-lk-ink" : "text-lk-muted hover:bg-lk-frame hover:text-lk-fg"
      }`}
    >
      <Icon className="size-4 shrink-0" />
      <span className="flex-1">{label}</span>
      {!!badge && <span className={`px-1.5 py-px text-[12px] font-semibold ${on ? "bg-lk-ink text-lk-lime" : "bg-lk-lime text-lk-ink"}`}>{badge}</span>}
    </Link>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-lk-line bg-lk-bg px-4 py-3 lg:hidden">
        <Brand />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          className="flex items-center gap-2 p-2 font-plex text-[13px] text-lk-muted uppercase outline outline-1 -outline-offset-1 outline-lk-gray"
        >
          {open ? <X className="size-4" /> : <Menu className="size-4" />}
          {!open && inboxCount > 0 && <span className="bg-lk-lime px-1.5 text-[12px] font-semibold text-lk-ink">{inboxCount}</span>}
        </button>
      </div>
      {open && <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setOpen(false)} />}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[264px] shrink-0 flex-col justify-between gap-6 overflow-y-auto border-r border-lk-line bg-lk-bg px-4 py-[22px] transition-transform lg:sticky lg:top-0 lg:z-auto lg:h-dvh lg:w-[232px] lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col gap-7">
          <Brand />

          <WorkspaceSwitcher
            workspace={workspace}
            workspaces={workspaces}
            canCreate={!!userEmail}
            warning={mailboxNeedsReconnect ? "Mailbox needs reconnecting" : null}
          />

          <nav className="flex flex-col gap-1">
            {nav.map((n) => item(n.href, n.label, n.icon, active(n.href, n.exact), n.badge === "inbox" ? inboxCount : undefined))}
          </nav>
        </div>

        <div className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-2 bg-lk-box p-3.5 outline outline-1 -outline-offset-1 outline-lk-line">
            <span className="font-plex text-[12px] tracking-[0.8px] text-lk-dim uppercase">Credits</span>
            {credits.enabled ? (
              <>
                <span className="text-[24px] leading-none font-semibold tracking-[-0.8px] text-lk-fg">{(credits.balance ?? 0).toLocaleString("en")}</span>
                <div className="h-1 bg-lk-line">
                  <div className="h-full bg-lk-lime" style={{ width: `${Math.min(100, ((credits.balance ?? 0) / 1000) * 100)}%` }} />
                </div>
              </>
            ) : (
              <span className="text-[15px] text-lk-fg">your own keys</span>
            )}
          </div>

          <div className="flex flex-col gap-1.5 px-2.5">
            {userEmail && (
              <span className="truncate font-plex text-[12px] text-lk-dim" title={userEmail}>
                {userEmail}
              </span>
            )}
            {/* reset() so whoever signs in next on this browser isn't merged into this person. */}
            <form action={logout} onSubmit={() => posthog.reset()}>
              <button className="flex items-center gap-2 font-plex text-[12.5px] tracking-[0.6px] text-lk-dim uppercase hover:text-lk-fg">
                <LogOut className="size-3.5" /> Sign out
              </button>
            </form>
          </div>
        </div>
      </aside>
    </>
  );
}
