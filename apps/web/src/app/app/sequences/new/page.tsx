import { Mail, Table2 } from "lucide-react";
import Link from "next/link";
import { AddLead } from "@/components/app/add-lead";
import { ImportCsv } from "@/components/app/import-csv";
import { SequenceForm } from "@/components/app/sequence-form";
import { buttonClass, Card, EmptyState, Page, PageHeader } from "@/components/app/ui";

// "LK · App New sequence" (FVCyx) in the .pen file.
import { load } from "@/lib/meerko";

export default async function NewSequencePage({ searchParams }: { searchParams: Promise<{ table?: string }> }) {
  const { table } = await searchParams;
  const [tables, mailboxes] = await load((c) => Promise.all([c.listTables(), c.listMailboxes()]));
  return (
    <Page>
      <PageHeader eyebrow="Sequences / New" title="New sequence" meta="Emails sent from your own mailbox, one person at a time, stopped when they reply." />
      {mailboxes.length === 0 ? (
        <Card>
          <EmptyState icon={Mail} title="Connect a mailbox first">
            Sequences send from your own Gmail or Google Workspace inbox.{" "}
            <span className="mt-4 flex justify-center"><Link href="/app/settings" className={buttonClass("primary")}>Go to Connections</Link></span>
          </EmptyState>
        </Card>
      ) : tables.length === 0 ? (
        <Card>
          <EmptyState icon={Table2} title="Add the people to email first">
            <span className="flex flex-col items-center gap-4">
              Import a CSV of leads, add someone by hand (yourself, for a test), or ask your agent to find some.
              <span className="flex flex-wrap items-start justify-center gap-3">
                <ImportCsv variant="primary" />
                <AddLead />
              </span>
            </span>
          </EmptyState>
        </Card>
      ) : (
        <SequenceForm
          tables={tables.map((t) => ({ id: t.id, name: t.name, rowCount: t.rowCount, columns: t.columns.map((c) => ({ key: c.key, name: c.name })) }))}
          mailboxes={mailboxes.map((m) => ({ id: m.id, email: m.email, status: m.status }))}
          defaultTableId={tables.some((t) => t.id === table) ? table : undefined}
        />
      )}
    </Page>
  );
}
