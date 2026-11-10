import { RefreshCw, ShieldCheck, Users } from "lucide-react";
import { DocsShell, docsMetadata } from "@/components/lookout/docs/shell";
import { crmSources } from "@/lib/sources";
import { AskAgent, C, Callout, Cards, Fields, H2, L, Tool } from "@/components/lookout/docs/ui";

export const metadata = docsMetadata("crm", "Sync cold email leads to HubSpot or Attio | Meerko docs");

export default function Page() {
  return (
    <DocsShell
      slug="crm"
      lead={
        <p>
          Meerko can push the leads it works on to your HubSpot or Attio as contacts, so your CRM knows who you&apos;ve emailed and where
          each lead stands, without a Zapier step in between.
        </p>
      }
      toc={[
        ["how", "How it works"],
        ["hubspot", "Connect HubSpot"],
        ["attio", "Connect Attio"],
        ["fields", "What gets written"],
        ["manual", "Syncing by hand"],
      ]}
      tools={["sync_crm"]}
    >
      <H2 id="how">How it works</H2>
      <Cards
        items={[
          [Users, "Contacted leads, automatically", "Once Meerko has emailed a lead, it goes to your CRM within a minute or two, and again whenever its stage changes."],
          [RefreshCw, "Matched by email", "An existing contact with the same email is updated, not duplicated. Leads without an email are skipped."],
          [ShieldCheck, "One way, your token", "Meerko only writes contacts; it never reads or deletes your CRM data. The token is stored encrypted."],
        ]}
      />
      <p>
        One CRM per workspace. Connect it in <L href="/app/settings#crm">Connections → CRM</L>, or with{" "}
        <C>pnpm meerko crm connect hubspot</C> (or <C>attio</C>), which asks for the token without showing it. Never paste a token into
        a chat with your agent. Turn auto-sync off to push only when you ask; disconnecting leaves the contacts already in the CRM.
      </p>

      <H2 id="hubspot">Connect HubSpot</H2>
      <p>
        Create a <strong className="text-fg">service key</strong> in HubSpot under Development → Keys → Service keys (
        <L href={crmSources.hubspotServiceKeys.url}>HubSpot&apos;s announcement</L>; HubSpot stopped new legacy private apps in October
        2026). Give it these scopes, then paste it in Connections:
      </p>
      <Fields
        head={["Scope", "Why"]}
        rows={[
          [<C key="r">crm.objects.contacts.read</C>, "Checks the key when you connect"],
          [<C key="w">crm.objects.contacts.write</C>, "Creates and updates contacts"],
          [<C key="s">crm.schemas.contacts.read</C>, "Optional: reads your Lead status options so the stage can be set"],
        ]}
      />
      <p>A private app token you already have works the same way.</p>

      <H2 id="attio">Connect Attio</H2>
      <p>
        Generate an API key in Attio&apos;s developer settings (<L href={crmSources.attioApiKey.url}>Attio&apos;s guide</L>) with read-write
        access to records and read access to object configuration, and paste it in Connections.
      </p>

      <H2 id="fields">What gets written</H2>
      <Fields
        head={["Meerko column", "HubSpot / Attio"]}
        rows={[
          [<C key="e">email</C>, "Email (the match key) / Email addresses"],
          [<C key="n">first_name, last_name</C>, "First and last name / Name"],
          [<C key="t">title</C>, "Job title"],
          [<C key="c">company, domain</C>, "Company name and website / the company record with that domain, created if missing"],
          [<C key="l">linkedin_url</C>, "— / LinkedIn"],
          [<C key="s">stage</C>, "Lead status (new, attempted to contact, connected, open deal, unqualified) / —"],
        ]}
      />
      <p>
        Empty cells never overwrite what your CRM already has. HubSpot gets the stage as Lead status when its default options exist
        (a won lead keeps its last status); Attio has no standard field for it, so stages stay in Meerko.
      </p>

      <H2 id="manual">Syncing by hand</H2>
      <p>
        <strong className="text-fg">Sync to HubSpot</strong> (or Attio) on a table pushes every row with an email that isn&apos;t there yet,
        including leads you haven&apos;t emailed. From the terminal it&apos;s <C>pnpm meerko crm sync &lt;tableId&gt;</C>; your agent uses{" "}
        <Tool name="sync_crm" />:
      </p>
      <AskAgent>Push the leads in my &quot;First customers&quot; table that fit 70+ to my CRM.</AskAgent>
      <Callout>
        <p>
          If the CRM rejects the token (it was revoked, or lacks a scope), auto-sync turns off and Connections shows the error. Connect
          again with a new token and it picks up where it stopped.
        </p>
      </Callout>
    </DocsShell>
  );
}
