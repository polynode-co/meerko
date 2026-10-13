import { BadgeCheck, Ban, Cookie, Download, Eye, Lock, MailCheck, Pencil, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import { Bullets, ContactCard, LegalShell, Ph, Section, Table, Callout } from "@/components/legal/shell";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy policy | Meerko",
  description: "What Meerko Cloud collects, how it handles Gmail data, who it shares data with, and your rights.",
  alternates: { canonical: "/privacy" },
};

// Every statement here must match what the code does (see the verified-facts rule in docs/CONTENT.md).
const toc: [string, string][] = [
  ["who-we-are", "Who we are"],
  ["what-we-collect", "What we collect"],
  ["gmail", "Gmail data"],
  ["use", "How we use it"],
  ["sharing", "Who we share it with"],
  ["storage", "Where it's stored"],
  ["retention", "How long we keep it"],
  ["rights", "Your rights"],
  ["recipients", "People you email"],
  ["cookies", "Cookies"],
  ["contact", "Contact"],
];

const rights = [
  [Eye, "Access", "Get a copy of your data"],
  [Pencil, "Correct", "Fix what's wrong"],
  [Trash2, "Delete", "Close your account and erase it"],
  [Download, "Export", "Take your data elsewhere"],
] as const;

export default function PrivacyPage() {
  return (
    <LegalShell
      title="Privacy policy"
      path="/privacy"
      toc={toc}
      summary={[
        [MailCheck, "We only keep Gmail messages from your Meerko threads", "Replies to emails Meerko sent, and messages from people in your sequences. The rest of your inbox is never stored."],
        [Lock, "Your Google tokens are encrypted", "Mailbox access tokens are stored encrypted, and we never see your Google password."],
        [Ban, "We don't sell data or train AI on it", "Meerko makes no AI calls. Your own agent does the thinking, on your side."],
        [Cookie, "Product analytics with PostHog, no ads", "We measure how Meerko is used (in the EU) to improve it. No ads or tracking pixels."],
      ]}
    >
      <Section n={1} id="who-we-are" title="Who we are">
        <p>
          Meerko Cloud is run by <Ph>Legal entity name</Ph>, <Ph>Registered address</Ph> (&quot;Meerko&quot;, &quot;we&quot;). For your account,
          we decide how your data is used (we&apos;re the controller). For the leads and emails you put into Meerko, we only process them on
          your instructions (we&apos;re your processor).
        </p>
      </Section>

      <Section n={2} id="what-we-collect" title="What we collect">
        <Table
          head={["Data", "What it is"]}
          rows={[
            ["Account", "Your name, email address and Google account ID, from Sign in with Google."],
            ["Mailboxes", "The Gmail address you connect, its access tokens (encrypted), your sender name and daily limit."],
            ["Your workspace", "Tables and leads you import or find, sequences, drafts, and their pipeline stages."],
            ["Emails", "Emails Meerko sends for you, and the replies in those threads."],
            ["Billing", "Your plan, subscription status and renewal date, your credit balance and purchases, and the ID Stripe gives your account. Card details stay with Stripe."],
            ["Connected apps", "Apps you approve (like Claude Code), when they were connected and last used."],
            ["Usage", "Pages you visit, clicks, and session recordings in which what you type and your workspace data are masked. Errors, with the page or request they happened on."],
            ["Agent tool calls", "When an agent uses Meerko Cloud's MCP server: which tool it called, the arguments and result, the short reason the agent gives, the agent app and model, and how long it took. Never your conversation with the agent."],
            ["Technical", "Server logs with IP addresses, kept by our hosting provider for security."],
          ]}
        />
      </Section>

      <Section n={3} id="gmail" title="Gmail data">
        <Callout icon={BadgeCheck}>
          Meerko&apos;s use and transfer of information received from Google APIs adheres to the{" "}
          <a href="https://developers.google.com/terms/api-services-user-data-policy" className="text-accent underline-offset-2 hover:underline">
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements.
        </Callout>
        <Bullets
          items={[
            "Meerko asks Google for two permissions: to send email as you, and to read your inbox so it can spot replies.",
            "It only stores messages in threads Meerko started, or from people in your sequences. For other recent mail it checks the sender's address and nothing else, and never stores it.",
            "Gmail data is used only to send your emails and handle replies. It's never sold, used for ads, or used to train AI models.",
            "Nobody at Meerko reads your email, unless you ask us to for support, or the law or a security investigation requires it.",
          ]}
        />
      </Section>

      <Section n={4} id="use" title="How we use it">
        <Bullets
          items={[
            "To run the service you asked for: search, enrichment, sequences, reply detection and the pipeline.",
            "To keep it secure: sign-in, abuse prevention and debugging.",
            "To understand how Meerko is used and fix what breaks (product analytics and error tracking).",
            "To answer you when you contact support.",
            "We don't sell personal data or use it for advertising.",
          ]}
        />
      </Section>

      <Section n={5} id="sharing" title="Who we share it with">
        <p>
          Only with the providers that run Meerko, under contracts that limit them to doing so. Apps you connect act on your behalf with
          the access you approved.
        </p>
        <Table
          head={["Sub-processor", "Purpose", "Location"]}
          rows={[
            ["Google Cloud", "Hosting, scheduling and secret storage", "Belgium (EU)"],
            ["Supabase", "Database", "Germany (EU)"],
            [
              <a key="n" href="https://posthog.com/privacy" className="text-accent underline-offset-2 hover:underline">
                PostHog
              </a>,
              "Product analytics, session recording, error tracking and agent tool-call analytics",
              "Germany (EU)",
            ],
            [
              <a key="s" href="https://stripe.com/privacy" className="text-accent underline-offset-2 hover:underline">
                Stripe
              </a>,
              "Payments: your billing name, email, address and tax ID, and your card, which Meerko never sees",
              "Ireland (EU) and United States",
            ],
            ["Icypeas", "Lead search and email finding: your search filters, and names with company domains", <Ph key="l">Location</Ph>],
          ]}
        />
      </Section>

      <Section n={6} id="storage" title="Where it's stored">
        <p>
          In the EU: the app runs in Google Cloud&apos;s Belgium region, the database in Supabase&apos;s Frankfurt region, and analytics in
          PostHog&apos;s EU cloud (Frankfurt). When a provider
          outside the EU is involved, the transfer is covered by the European Commission&apos;s Standard Contractual Clauses.
        </p>
      </Section>

      <Section n={7} id="retention" title="How long we keep it">
        <p>
          For as long as your account is open. When you ask us to delete your account, we delete your workspace data within <Ph>30</Ph>{" "}
          days, and it leaves backups within <Ph>X</Ph> days after that. Disconnecting a mailbox or an app ends its access straight away.
        </p>
      </Section>

      <Section n={8} id="rights" title="Your rights">
        <div className="grid gap-3 sm:grid-cols-2">
          {rights.map(([Icon, t, d]) => (
            <div key={t} className="flex items-center gap-3 rounded-xl border border-line px-4 py-3.5">
              <Icon className="size-4 shrink-0 text-accent" />
              <span className="flex flex-col">
                <span className="text-[15px] font-semibold text-fg">{t}</span>
                <span className="text-[13px]">{d}</span>
              </span>
            </div>
          ))}
        </div>
        <p>
          Email{" "}
          <a href={`mailto:${site.contactEmail}`} className="font-medium text-accent underline-offset-2 hover:underline">
            {site.contactEmail}
          </a>{" "}
          and we&apos;ll answer within 30 days. You can also complain to your data protection authority.
        </p>
      </Section>

      <Section n={9} id="recipients" title="People you email">
        <p>
          If you got an email sent through Meerko: it came from the sender&apos;s own Gmail account, and they decided to send it. Every
          sequence email has an unsubscribe link; using it stops all of that sender&apos;s Meerko emails to you. To ask what data a sender
          holds about you, contact them, or write to us and we&apos;ll pass it on.
        </p>
      </Section>

      <Section n={10} id="cookies" title="Cookies">
        <p>The cookies needed to sign you in, and one analytics cookie from PostHog. No advertising cookies.</p>
        <Table
          head={["Cookie", "What it's for", "Lasts"]}
          rows={[
            ["meerko_session", "Keeps you signed in to the dashboard", "30 days"],
            ["meerko_next", "Brings you back to the page you were on after signing in", "15 minutes"],
            ["ph_<key>_posthog", "PostHog analytics: recognises the same browser across visits (also kept in local storage)", "1 year"],
            ["meerko_signin_nonce", "Ties a Google sign-in to the browser that started it, so nobody can sign you in to their account", "10 minutes"],
          ]}
        />
      </Section>

      <Section n={11} id="contact" title="Contact">
        <ContactCard title="Questions about your data?" email={site.contactEmail} />
        <p>We&apos;ll post changes here and update the date at the top. For significant changes, we&apos;ll email account owners first.</p>
      </Section>
    </LegalShell>
  );
}
