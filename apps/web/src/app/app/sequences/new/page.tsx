import { Mail, Table2 } from "lucide-react";
import Link from "next/link";
import { AddLead } from "@/components/app/add-lead";
import { ImportCsv } from "@/components/app/import-csv";
import { SequenceForm } from "@/components/app/sequence-form";
import { buttonClass, Card, EmptyState, PageHeader } from "@/components/app/ui";
import { load } from "@/lib/meerko";

export default async function NewSequencePage({ searchParams }: { searchParams: Promise<{ table?: string }> }) {
  const { table } = await searchParams;
  const [tables, mailboxes] = await load((c) => Promise.all([c.listTables(), c.listMailboxes()]));
  return (
    <div className="flex max-w-4xl flex-col gap-6 px-8 py-7">
      <PageHeader eyebrow="Sequences / New" title="New sequence" meta="Emails sent from your own mailbox, one person at a time, stopped when they reply." />
      {mailboxes.length === 0 ? (
        <Card>
          <EmptyState icon={Mail} title="Connect a mailbox first">
            Sequences send from your own Gmail or Google Workspace inbox.{" "}
            <Link href="/app/settings" className={`${buttonClass("primary")} mt-3`}>Go to Settings</Link>
          </EmptyState>
        </Card>
      ) : tables.length === 0 ? (
        <Card>
          <EmptyState icon={Table2} title="Add the people to email first">
            <span className="flex flex-col items-center gap-3">
              Import a CSV of leads, add someone by hand (yourself, for a test), or ask your agent to find some.
              <span className="flex flex-wrap items-start justify-center gap-2">
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
    </div>
  );
}
