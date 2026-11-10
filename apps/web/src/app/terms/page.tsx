import { Code, Coins, Database, MailWarning } from "lucide-react";
import type { Metadata } from "next";
import { Bullets, Callout, ContactCard, LEGAL_ENTITY, LegalShell, Section } from "@/components/legal/shell";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of service | Meerko",
  description: "The terms for using Meerko Cloud: your account, acceptable use, your data, credits and liability.",
  alternates: { canonical: "/terms" },
};

const toc: [string, string][] = [
  ["agreement", "The agreement"],
  ["open-source", "Cloud and open source"],
  ["account", "Your account"],
  ["acceptable-use", "Acceptable use"],
  ["data", "Your data"],
  ["credits", "Credits and payment"],
  ["lead-data", "Lead data"],
  ["availability", "Availability"],
  ["liability", "Liability"],
  ["ending", "Ending"],
  ["law", "Governing law"],
  ["contact", "Contact"],
];

export default function TermsPage() {
  return (
    <LegalShell
      title="Terms of service"
      path="/terms"
      toc={toc}
      summary={[
        [MailWarning, "You're the sender", "Email only people you're allowed to contact, and follow anti-spam law. Meerko adds the unsubscribe link; the rest is on you."],
        [Database, "Your data stays yours", "You own what you put in. We process it only to run Meerko for you."],
        [Coins, "Credits pay for lookups", "Search and email finding cost credits. Free credits have no cash value."],
        [Code, "The code is AGPL-3.0", "Self-hosting is governed by the open-source license, not these terms."],
      ]}
    >
      <Section n={1} id="agreement" title="The agreement">
        <p>
          These terms are between you and {LEGAL_ENTITY.name}, {LEGAL_ENTITY.address}, tax ID (CIF) {LEGAL_ENTITY.taxId} (&quot;Meerko&quot;,
          &quot;we&quot;). By using
          Meerko Cloud you accept them. If you use it for a company, you confirm you&apos;re allowed to accept them on its behalf.
        </p>
      </Section>

      <Section n={2} id="open-source" title="Cloud and open source">
        <p>
          These terms cover Meerko Cloud, the hosted service. Meerko&apos;s source code is published under the GNU AGPL-3.0; if you run it
          yourself, that license applies instead, and these terms don&apos;t.
        </p>
      </Section>

      <Section n={3} id="account" title="Your account">
        <Bullets
          items={[
            "Sign in with a Google account or an email address you control, and keep it secure. Your first sign-in creates your workspace.",
            "You're responsible for what happens in your workspace, including what API keys and connected apps do. An agent you approve acts with your authority.",
            "Disconnect apps and revoke keys you no longer use, from Connections.",
          ]}
        />
      </Section>

      <Section n={4} id="acceptable-use" title="Acceptable use">
        <Callout icon={MailWarning}>
          Emails go out from your own mailbox, as you. You&apos;re the sender, and you&apos;re responsible for following the law where you and
          your recipients are.
        </Callout>
        <Bullets
          items={[
            "Only email people you have a lawful basis to contact, and stop when they ask. Meerko adds an unsubscribe link to every sequence email.",
            "Follow anti-spam and privacy law, such as CAN-SPAM (including your postal address in commercial email) and the GDPR and ePrivacy rules in the EU.",
            "Follow Google's terms and sending limits, and don't try to get around them.",
            "No phishing, malware, impersonation, harassment or deceptive content.",
            "Don't resell data you got through Meerko, or use Meerko to build a competing data product.",
            "Don't probe, overload or attack the service, or access other workspaces.",
          ]}
        />
      </Section>

      <Section n={5} id="data" title="Your data">
        <p>
          You own the data you put into Meerko. You let us store and process it only to run the service for you, as described in the{" "}
          <a href="/privacy" className="text-lk-lime underline-offset-4 hover:underline">
            Privacy policy
          </a>
          . If you need a data processing agreement for the leads and emails we process for you, write to{" "}
          <a href={`mailto:${site.contactEmail}`} className="text-lk-lime underline-offset-4 hover:underline">
            {site.contactEmail}
          </a>{" "}
          and we&apos;ll sign one with you.
        </p>
      </Section>

      <Section n={6} id="credits" title="Credits and payment">
        <Bullets
          items={[
            <>
              Credits pay for data lookups: search results and found or verified emails. Prices are on the{" "}
              <a href="/pricing" className="text-lk-lime underline-offset-4 hover:underline">
                pricing page
              </a>
              ; misses are free.
            </>,
            "Free credits have no cash value and can be withdrawn if they're abused.",
            "Pro is billed monthly in advance and renews until you cancel it in Connections → Manage billing. Cancelling stops the next renewal; Pro lasts until the end of the month you paid for.",
            "Free and bought credits don't expire while your account is open. Pro's monthly credits can be used in the month they're added and the month after, then lapse; they also lapse when Pro ends. Spending uses the credits that lapse soonest first.",
            <>
              Payments are processed by Stripe. You can cancel Pro at any time; there are no refunds for part of a month. Other refunds,
              including for unused credit packs, are handled case by case: write to {site.contactEmail}. Prices can change with 30 days&apos;
              notice; credits you already bought keep their value.
            </>,
          ]}
        />
      </Section>

      <Section n={7} id="lead-data" title="Lead data">
        <p>
          Lead search and email finding use third-party data providers. We can&apos;t guarantee that data is accurate or complete, and you
          decide how to use it, within the law.
        </p>
      </Section>

      <Section n={8} id="availability" title="Availability">
        <p>
          Meerko Cloud is early software, provided as is. We work to keep it running and your data safe, but we don&apos;t promise it will
          be uninterrupted or error-free. We may change or remove features; if a change takes something important away, we&apos;ll tell
          you first.
        </p>
      </Section>

      <Section n={9} id="liability" title="Liability">
        <p>
          To the extent the law allows, we aren&apos;t liable for indirect or consequential losses, and our total liability is capped at what
          you paid us in the 12 months before the claim. Nothing here limits liability that can&apos;t legally be limited.
        </p>
      </Section>

      <Section n={10} id="ending" title="Ending">
        <p>
          You can stop using Meerko and ask us to delete your account at any time. We may suspend or close accounts that break these terms
          (for example, sending spam that draws complaints), with notice where we reasonably can.
        </p>
      </Section>

      <Section n={11} id="law" title="Governing law">
        <p>
          These terms are governed by the laws of Spain, and disputes go to the courts of Bilbao, unless your local
          consumer law gives you other rights.
        </p>
      </Section>

      <Section n={12} id="contact" title="Contact">
        <ContactCard title="Questions about these terms?" email={site.contactEmail} />
        <p>
          We&apos;ll post changes here and update the date at the top. For changes that affect you materially, we&apos;ll email account owners
          at least 30 days before they take effect.
        </p>
      </Section>
    </LegalShell>
  );
}
