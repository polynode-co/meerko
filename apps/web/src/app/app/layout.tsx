import type { Metadata } from "next";
import { PostHogIdentify } from "@/components/analytics/posthog-identify";
import { Sidebar } from "@/components/app/sidebar";
import { load } from "@/lib/meerko";

export const metadata: Metadata = { title: "Meerko", robots: { index: false } };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [me, mailboxes, replies, credits, workspaces] = await load((c) =>
    Promise.all([c.me(), c.listMailboxes(), c.listReplies({ limit: 100 }), c.getCredits(), c.listWorkspaces()]),
  );
  const mailbox = mailboxes[0] ?? null;

  return (
    <div className="flex min-h-dvh flex-col bg-lk-bg text-lk-fg lg:flex-row">
      <Sidebar
        workspace={me.workspace.name}
        workspaces={workspaces}
        userEmail={me.user?.email ?? null}
        mailboxNeedsReconnect={mailbox?.status === "error"}
        inboxCount={replies.length}
        credits={credits}
      />
      <PostHogIdentify user={me.user} workspace={me.workspace} />
      {/* data-ph-mask: leads, replies and drafts are prospects' data, so session replays show them as masked text. */}
      <main data-ph-mask className="min-w-0 flex-1">
        {children}
      </main>
    </div>
  );
}
