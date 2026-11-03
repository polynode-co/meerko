import { FindLeads } from "@/components/app/find-leads";
import { Card, PageHeader } from "@/components/app/ui";
import { load } from "@/lib/meerko";

export default async function FindLeadsPage() {
  const [tables, credits] = await load((c) => Promise.all([c.listTables(), c.getCredits()]));
  return (
    <div className="flex flex-col gap-6 px-8 py-7">
      <PageHeader
        eyebrow="Leads"
        title="Find leads"
        meta="Search people and companies, see how many match for free, then save the ones you want into a table."
      />
      <Card raised className="max-w-3xl p-6">
        <FindLeads tables={tables.map((t) => ({ id: t.id, name: t.name }))} credits={credits.enabled ? credits.balance : null} />
      </Card>
    </div>
  );
}
