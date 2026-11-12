import { Mail, Table2 } from "lucide-react";
import Link from "next/link";
import { AddLead } from "@/components/app/add-lead";
import { ImportCsv } from "@/components/app/import-csv";
import { SequenceForm } from "@/components/app/sequence-form";
import { buttonClass, Card, crumb, EmptyState, Page, PageHeader } from "@/components/app/ui";
import { load } from "@/lib/meerko";

// "WS3 · New sequence" (AB7IW) in the .pen file. The form renders its own header, since its save button sits there.

export default async function NewSequencePage({ searchParams }: { searchParams: Promise<{ table?: string }> }) {
  const { table } = await searchParams;
  const [tables, mailboxes] = await load((c) => Promise.all([c.listTables(), c.listMailboxes()]));
  return (
    <Page>
      {(mailboxes.length === 0 || tables.length === 0) && (
        <PageHeader
          eyebrow={
            <span className={crumb}>
              <Link href="/app/sequences" className="hover:text-lk-fg">
                Sequences
              </Link>{" "}
              ›
            </span>
          }
          title="New sequence"
          meta="Saved as a draft · nothing sends until you start it"
        />
      )}
      {mailboxes.length === 0 ? (
        <Card>
          <EmptyState icon={Mail} title="Connect a mailbox first">
            Sequences send from your own Gmail or Google Workspace inbox.
            <span className="mt-4 flex justify-center">
              <Link href="/app/settings" className={buttonClass("primary")}>
                Go to Connections
              </Link>
            </span>
          </EmptyState>
        </Card>
      ) : tables.length === 0 ? (
        <Card>
          <EmptyState icon={Table2} title="Add the people to email first">
            <span className="flex flex-col items-center gap-4">
              Import a CSV, add someone by hand (yourself, for a test), or ask your agent to find some.
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
