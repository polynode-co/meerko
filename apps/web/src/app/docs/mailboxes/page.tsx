import { AlertTriangle } from "lucide-react";
import { DocsShell, docsMetadata } from "@/components/docs/shell";
import { googleSources } from "@/lib/sources";
import { AskAgent, C, Callout, Facts, H2, L, Tool } from "@/components/docs/ui";

export const metadata = docsMetadata("mailboxes", "Send cold email from your own Gmail | Meerko docs");

export default function Page() {
  return (
    <DocsShell
      slug="mailboxes"
      h1="Mailboxes"
      lead={
        <p>
          Meerko sends from your own Gmail or Google Workspace inbox, through Google&apos;s API, so every email sits in your Sent folder and
          every reply lands in your inbox, where Meerko picks it up.
        </p>
      }
      toc={[
        ["connect", "Connecting Gmail"],
        ["limits", "Daily limit and spacing"],
        ["ramp", "Ramp-up for new mailboxes"],
        ["domains", "Domain health"],
        ["test", "Sending a test"],
        ["reconnect", "When a mailbox needs reconnecting"],
      ]}
      tools={["connect_gmail", "list_mailboxes", "update_mailbox", "send_test_email", "check_domains"]}
    >
      <H2 id="connect">Connecting Gmail</H2>
      <p>
        From the dashboard, <L href="/app/settings">Settings → Connect Gmail</L>. From your agent, <Tool name="connect_gmail" /> returns a
        Google link to open. From the terminal, <C>pnpm meerko mailboxes connect</C> opens it in your browser and waits for you to
        finish.
      </p>
      <p>
        Google asks for two permissions: sending email, and reading your inbox (to spot replies). Tick both. Meerko only fetches in full
        the messages in threads it started or from people in your sequences; other mail is never stored.
      </p>

      <H2 id="limits">Daily limit and spacing</H2>
      <Facts
        items={[
          ["Daily limit", "50", "Per mailbox by default, counted over the last 24 hours. Set 1 to 500."],
          ["Spacing", "3–7 min", "Between two sends from the same mailbox, at random, so they don't go out in bursts."],
          ["Sender name", "Optional", "The name recipients see in From. Set it with update_mailbox."],
        ]}
      />
      <p>
        Start low on a new inbox, e.g. 30 to 50 a day, and raise it slowly. Answers you approve from the inbox count toward the limit
        too. More on staying out of spam in the <L href="/guides/gmail-sending-limits">Gmail sending limits</L> and{" "}
        <L href="/guides/email-deliverability">deliverability</L> guides.
      </p>
      <AskAgent>Set my main mailbox to 30 emails a day, with the sender name &quot;Ana from Acme&quot;.</AskAgent>

      <H2 id="ramp">Ramp-up for new mailboxes</H2>
      <p>
        A brand-new inbox that suddenly sends 50 cold emails a day looks suspicious. So every mailbox you connect ramps up on its own: it
        starts at 10 emails a day and climbs evenly to its daily limit over 21 days. The dashboard and <Tool name="list_mailboxes" /> show
        today&apos;s limit and the ramp day.
      </p>
      <p>
        Connecting an inbox that already sends regularly? Turn the ramp off with <Tool name="update_mailbox" /> (<C>ramp: false</C>) or{" "}
        <C>pnpm meerko mailboxes set &lt;id&gt; --no-ramp</C>. <C>--ramp</C> starts it again from today.
      </p>

      <H2 id="domains">Domain health</H2>
      <p>
        Google asks every sender to set up SPF or DKIM, and bulk senders to have SPF, DKIM and DMARC (
        <L href={googleSources.senderGuidelines.url}>Google&apos;s sender guidelines</L>). Meerko looks up all three for every domain you
        send from and shows them on each sequence, so a missing record doesn&apos;t go unnoticed. Ask your agent, or run{" "}
        <C>pnpm meerko mailboxes health</C>:
      </p>
      <AskAgent>Check my sending domains and tell me which DNS records to add.</AskAgent>
      <p>
        DKIM is checked at Google Workspace&apos;s default selector (<C>google</C>). For plain Gmail addresses, Google handles all three for
        you. The <L href="/guides/email-deliverability">deliverability guide</L> has the setup steps.
      </p>

      <H2 id="test">Sending a test</H2>
      <p>
        <Tool name="send_test_email" /> sends a short &quot;Meerko test email&quot; from the mailbox to an address you choose. Send it to
        yourself to check the connection.
      </p>

      <H2 id="reconnect">When a mailbox needs reconnecting</H2>
      <Callout icon={AlertTriangle}>
        <p>
          If Google stops accepting the mailbox&apos;s access, for example because the permission was removed from your Google account, it shows as{" "}
          <C>error</C>. Its sequences wait instead of failing: reconnect it from Settings (or run <C>connect_gmail</C> again with the same
          address) and they pick up where they stopped.
        </p>
      </Callout>
    </DocsShell>
  );
}
