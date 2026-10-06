"use client";

import { Inbox, KeyRound, LayoutDashboard, LogOut, Send, Table2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoMark } from "@/components/ui/brand";
import { logout } from "@/app/app/actions";

const nav = [
  { href: "/app", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/app/leads", label: "Leads", icon: Table2 },
  { href: "/app/sequences", label: "Sequences", icon: Send },
  { href: "/app/inbox", label: "Inbox", icon: Inbox, badge: "inbox" as const },
];

export interface SidebarProps {
  mailbox: string | null;
  mailboxNeedsReconnect: boolean;
  inboxCount: number;
  credits: { enabled: boolean; balance: number | null };
}

export function Sidebar({ mailbox, mailboxNeedsReconnect, inboxCount, credits }: SidebarProps) {
  const path = usePathname();
  const active = (href: string, exact?: boolean) => (exact ? path === href : path === href || path.startsWith(href + "/"));

  const item = (href: string, label: string, Icon: typeof Inbox, on: boolean, badge?: number) => (
    <Link
      key={href}
      href={href}
      className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition ${on ? "bg-raised text-fg" : "text-muted hover:text-fg"}`}
    >
      <Icon className={`size-4 ${on ? "text-accent" : ""}`} />
      <span className="flex-1">{label}</span>
      {!!badge && <span className="rounded-full bg-signal px-[7px] py-px font-mono text-[11px] font-bold text-dark">{badge}</span>}
    </Link>
  );

  return (
    <aside className="sticky top-0 flex h-dvh w-60 shrink-0 flex-col gap-6 border-r border-line px-3 py-5">
      <Link href="/app" className="flex items-center gap-2 px-2">
        <LogoMark size={30} />
        <span className="font-display text-xl font-bold tracking-tight">meerko</span>
      </Link>

      <div className="rounded-lg border border-line bg-raised px-2.5 py-2">
        <p className="text-[13px] font-semibold">Workspace</p>
        <p className={`truncate font-mono text-[11px] ${mailboxNeedsReconnect ? "text-[#e5795b]" : "text-muted"}`}>
          {mailbox ? (mailboxNeedsReconnect ? `${mailbox} · reconnect` : mailbox) : "no mailbox connected"}
        </p>
      </div>

      <nav className="flex flex-col gap-0.5">
        {nav.map((n) => item(n.href, n.label, n.icon, active(n.href, n.exact), n.badge === "inbox" ? inboxCount : undefined))}
      </nav>

      <div className="flex flex-col gap-0.5">
        <p className="px-2.5 pb-1.5 font-mono text-[10px] tracking-[0.12em] text-muted/70">SETTINGS</p>
        {item("/app/settings", "Mailboxes & keys", KeyRound, active("/app/settings"))}
      </div>

      <div className="flex-1" />

      <div className="flex flex-col gap-2 rounded-lg border border-line p-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted">Credits</span>
          <span className="font-mono">{credits.enabled ? (credits.balance ?? 0).toLocaleString("en") : "your own keys"}</span>
        </div>
        {credits.enabled && (
          <div className="h-1 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, ((credits.balance ?? 0) / 1000) * 100)}%` }} />
          </div>
        )}
        <form action={logout}>
          <button className="flex items-center gap-1.5 text-[11px] text-muted hover:text-fg">
            <LogOut className="size-3" /> Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
