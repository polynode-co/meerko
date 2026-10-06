import type { Metadata } from "next";
import { Sidebar } from "@/components/app/sidebar";
import { load } from "@/lib/meerko";

export const metadata: Metadata = { title: "Meerko", robots: { index: false } };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [me, mailboxes, replies, credits] = await load((c) =>
    Promise.all([c.me(), c.listMailboxes(), c.listReplies({ limit: 100 }), c.getCredits()]),
  );
  const mailbox = mailboxes[0] ?? null;

  return (
    <div className="flex min-h-dvh">
      <Sidebar
        workspace={me.workspace.name}
        userEmail={me.user?.email ?? null}
        mailbox={mailbox?.email ?? null}
        mailboxNeedsReconnect={mailbox?.status === "error"}
        inboxCount={replies.length}
        credits={credits}
      />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
