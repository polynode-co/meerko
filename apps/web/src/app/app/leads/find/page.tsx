import { FindLeads } from "@/components/app/find-leads";
import { AgentHint, Card, CardHead, Page, PageHeader, Pill } from "@/components/app/ui";
import { load } from "@/lib/meerko";

// "LK · App Find leads" (oxUjs) in the .pen file.

export default async function FindLeadsPage() {
  const [tables, credits] = await load((c) => Promise.all([c.listTables(), c.getCredits()]));
  return (
    <Page>
      <PageHeader
        eyebrow="Leads / Find"
        title="Find leads"
        meta="Search people and companies, see how many match for free, then save the ones you want into a table."
        actions={credits.enabled && <Pill tone="amber">{(credits.balance ?? 0).toLocaleString("en")} credits</Pill>}
      />
      <Card className="max-w-[880px]">
        <CardHead title="Who do you sell to?" />
        <div className="p-[18px]">
          <FindLeads tables={tables.map((t) => ({ id: t.id, name: t.name }))} credits={credits.enabled ? credits.balance : null} />
        </div>
      </Card>
      <div className="max-w-[880px]">
        <AgentHint command="find 50 fintech CTOs in Spain">Or let your agent search for you.</AgentHint>
      </div>
    </Page>
  );
}
