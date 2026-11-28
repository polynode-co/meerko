import { AlertTriangle } from "lucide-react";
import { DocsShell, docsMetadata } from "@/components/lookout/docs/shell";
import { googleSources } from "@/lib/sources";
import { AskAgent, C, Callout, Facts, H2, L, Tool } from "@/components/lookout/docs/ui";

export const metadata = docsMetadata("mailboxes", "Send cold email from your own Gmail or Outlook | Meerko docs");

export default function Page() {
  return (
    <DocsShell
      slug="mailboxes"
      h1="Mailboxes"
      lead={
        <p>
          Meerko sends from your own inbox (Gmail, Google Workspace, Outlook, Microsoft 365 or any IMAP provider), the way a mail app does, so every email sits in your Sent folder and
          every reply lands in your inbox, where Meerko picks it up.
        </p>
      }
      toc={[
        ["connect", "Connecting a mailbox"],
        ["no-app-password", "When App passwords isn't there"],
        ["why", "Why not Sign in with Google"],
        ["limits", "Daily limit and spacing"],
        ["ramp", "Ramp-up for new mailboxes"],
        ["domains", "Domain health"],
        ["test", "Sending a test"],
        ["reconnect", "When a mailbox needs reconnecting"],
      ]}
      tools={["manage_mailbox", "list_mailboxes", "send_test_email"]}
    >
      <H2 id="connect">Connecting a mailbox</H2>
      <p>
        Meerko connects to Gmail and Google Workspace inboxes with an <strong className="text-fg">app password</strong>: it sends
        through Gmail&apos;s SMTP server and reads replies over IMAP, as a mail app would. To make one:
      </p>
      <ol className="flex list-decimal flex-col gap-1.5 pl-6">
        <li>
          Turn on <L href="https://myaccount.google.com/signinoptions/twosv">2-Step Verification</L> for the Google account. App passwords
          need it.
        </li>
        <li>
          Open <L href="https://myaccount.google.com/apppasswords">App passwords</L>, name it &quot;Meerko&quot; and copy the 16 letters.
        </li>
        <li>
          Paste it in <L href="/app/settings?connect=gmail">Connections → Connect mailbox</L>, or run <C>pnpm meerko mailboxes connect</C>.
          Meerko checks it with Gmail before saving it, encrypted.
        </li>
      </ol>
      <p>
        Your agent&apos;s <Tool name="manage_mailbox" /> (<C>action: &quot;connect&quot;</C>) gives you the same link: never paste the password into a chat. Google emails you a
        security alert when the password is created and first used; that&apos;s expected.
      </p>
      <p>
        If the address is an alias of another Google account (say <C>you@brand.com</C> on a <C>you@company.com</C> account), also enter
        the account you sign in with: Gmail only accepts that one. Meerko still sends from the alias.
      </p>
      <p>
        <strong className="text-fg">Zoho Mail, Fastmail or any other provider</strong> with IMAP and SMTP connects the same way: pick it in
        the form, or run <C>pnpm meerko mailboxes connect --provider zoho</C> (<C>zoho-eu</C>, <C>fastmail</C> or <C>other</C>). Turn on IMAP
        for the account and use an app password if the provider offers them. For a provider that isn&apos;t listed, choose Other and enter
        its IMAP server (port 993) and SMTP server (465 or 587): Meerko only connects over TLS, and only to public servers. When the
        provider doesn&apos;t file sent emails in Sent itself, Meerko saves a copy there.
      </p>
      <p>
        <strong className="text-fg">Outlook and Microsoft 365</strong> don&apos;t allow passwords, so they connect with Sign in with
        Microsoft instead: pick Outlook in the form (or run <C>pnpm meerko mailboxes connect --provider outlook</C>) and approve Meerko. It
        asks Microsoft to send email as you and to read your mail, to spot replies. Some companies only let their IT admin approve
        apps; if Microsoft says you need an admin, ask them to approve Meerko once for everyone. Remove its access any time at{" "}
        <L href="https://myapps.microsoft.com">myapps.microsoft.com</L> (work accounts) or{" "}
        <L href="https://account.live.com/consent/Manage">account.live.com</L> (personal accounts).
      </p>
      <p>
        Meerko only fetches in full the messages in threads it started or from people in your sequences; other mail is never stored or
        marked read. Accounts with Advanced Protection, or Workspaces that only allow security keys, can&apos;t create app passwords.
      </p>
      <p>
        On Meerko Cloud, the Free plan connects one mailbox and <L href="/pricing">Pro</L> connects as many as you like. Reconnecting a
        mailbox you already have always works. Self-hosted installs have no limit.
      </p>

      <H2 id="no-app-password">When App passwords isn&apos;t there</H2>
      <p>
        If the App passwords page says the setting isn&apos;t available, or Meerko can&apos;t log in with the password, it&apos;s one of
        these (<L href={googleSources.appPasswords.url}>Google&apos;s list</L>):
      </p>
      <ul className="flex list-disc flex-col gap-1.5 pl-6">
        <li>
          <strong className="text-fg">2-Step Verification is off.</strong> Turn it on first; App passwords appears after.
        </li>
        <li>
          <strong className="text-fg">2-Step Verification uses only security keys, or the account has Advanced Protection.</strong> Add
          another second step (such as Google prompts or an authenticator app), or connect a different mailbox.
        </li>
        <li>
          <strong className="text-fg">It&apos;s a Google Workspace account and the admin restricts it.</strong> If you&apos;re the
          admin, in the <L href="https://admin.google.com">Admin console</L>: under Security → Authentication → 2-Step Verification,
          let users turn it on; under Apps → Google Workspace → Gmail → End user access, turn IMAP on and allow any IMAP client, not
          only OAuth clients (<L href={googleSources.imapAdmin.url}>Google&apos;s steps</L>). Changes can take a while to apply. If
          you&apos;re not the admin, send them this section.
        </li>
        <li>
          <strong className="text-fg">You used your normal Google password.</strong> Gmail only accepts the 16-letter app password
          here.
        </li>
      </ul>
      <p>
        Still stuck? An Outlook or Microsoft 365 mailbox connects with Sign in with Microsoft and needs no app password, and Zoho or
        Fastmail connect like Gmail.
      </p>

      <H2 id="why">Why not Sign in with Google</H2>
      <p>
        To spot replies, Meerko has to read your inbox. Reading Gmail through Google&apos;s API needs a scope Google classes as
        restricted (<L href={googleSources.gmailScopes.url}>Gmail API scopes</L>), and an app using one must pass a paid security
        assessment every year (<L href={googleSources.restrictedScopes.url}>Google&apos;s requirement</L>). An app password gives
        Meerko the same access a mail app has, over IMAP and SMTP, and you can revoke it any time. Self-hosting? Your own Google
        OAuth client can connect Gmail through Google instead; see{" "}
        <L href="/docs/self-hosting">self-hosting</L>.
      </p>

      <H2 id="limits">Daily limit and spacing</H2>
      <Facts
        items={[
          ["Daily limit", "50", "Per mailbox by default, counted over the last 24 hours. Set 1 to 500."],
          ["Spacing", "3–7 min", "Between two sends from the same mailbox, at random, so they don't go out in bursts."],
          ["Sender name", "Optional", "The name recipients see in From. Set it with manage_mailbox."],
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
        Connecting an inbox that already sends regularly? Turn the ramp off with <Tool name="manage_mailbox" /> (<C>ramp: false</C>) or{" "}
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
        yourself to check the connection. In the dashboard it&apos;s <strong className="text-fg">Send test</strong> next to each
        mailbox in Connections; from the terminal, <C>pnpm meerko mailboxes test &lt;id&gt; --to you@example.com</C>.
      </p>

      <H2 id="reconnect">When a mailbox needs reconnecting</H2>
      <Callout icon={AlertTriangle}>
        <p>
          If Gmail stops accepting the mailbox&apos;s app password, for example because you removed it or changed your Google password
          (which revokes app passwords), it shows as <C>error</C>. Its sequences wait instead of failing: create a new app password,
          reconnect it from Connections with the same address, and they pick up where they stopped. Removing a mailbox from Meerko
          doesn&apos;t revoke the password: remove it from <L href="https://myaccount.google.com/apppasswords">App passwords</L> too.
        </p>
      </Callout>
    </DocsShell>
  );
}
