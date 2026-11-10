import { KeyRound } from "lucide-react";
import { CodeBlock } from "@/components/lookout/docs/code-block";
import { DocsShell, docsMetadata } from "@/components/lookout/docs/shell";
import { C, Callout, Fields, H2, L, Tool } from "@/components/lookout/docs/ui";
import { docsSources } from "@/lib/sources";

export const metadata = docsMetadata("credits");

export default function Page() {
  return (
    <DocsShell
      slug="credits"
      lead={
        <p>
          On Meerko Cloud, lead search and email finding cost credits. Sending, replies, AI columns and everything else don&apos;t. Your
          first workspace starts with 200 free credits, and all your <L href="/docs/workspaces">workspaces</L> share one balance.
        </p>
      }
      toc={[
        ["costs", "What costs credits"],
        ["running-out", "Running out"],
        ["buying", "Buying credits"],
        ["own-key", "Use your own provider key"],
        ["firecrawl", "Find more emails with Firecrawl"],
        ["generect", "Phone numbers and Generect"],
        ["self-hosted", "Self-hosted"],
      ]}
      tools={["get_credits"]}
    >
      <H2 id="costs">What costs credits</H2>
      <Fields
        head={["Action", "Credits"]}
        rows={[
          ["Search result saved", "1 per result"],
          ["Email found", "8"],
          ["Email verified", "1"],
          ["Phone number found", "80, on Pro"],
          ["Counting search results", "Free"],
          ["Searches and lookups that find nothing", "Free"],
        ]}
      />
      <p>
        AI columns cost nothing because your own agent answers them. Plans and prices are on the <L href="/pricing">pricing page</L>. Check
        your balance with <Tool name="get_credits" />, <C>pnpm meerko credits</C> or the dashboard&apos;s Connections.
      </p>

      <H2 id="running-out">Running out</H2>
      <p>
        A search saves as many results as your balance pays for. Email finding stops when credits run out and says so; the rows it
        didn&apos;t reach are picked up next time. The <C>find-leads</C> command checks your balance first and asks before spending more
        than 500.
      </p>

      <H2 id="buying">Buying credits</H2>
      <p>
        A workspace owner buys credits in the dashboard&apos;s Connections, under Plan &amp; credits, on any plan: packs of 1,000 credits for
        $10, paid with Stripe. Pro ($49 a month) adds 4,900 credits when you subscribe and each time it renews, lets you connect more than one mailbox, and lets you use your own provider keys with no credits charged. Bought and free
        credits never expire. Pro&apos;s monthly credits roll over one month, then lapse, and lapse when Pro ends; spending uses the credits that
        lapse soonest first. Cancel or change your card from Manage billing.
      </p>
      <p>
        <Tool name="get_credits" /> shows your agent the balance, so it can warn you before a large search. Plans and
        top-ups live in Connections, not in the chat: the Claude and ChatGPT app directories don&apos;t allow buying inside an app. The
        REST API&apos;s <C>GET /v1/credits</C> still returns the plan and a <C>buy_url</C> for your own scripts.
      </p>
      <H2 id="own-key">Use your own provider key</H2>
      <Callout icon={KeyRound}>
        <p>
          Have an <L href={docsSources.icypeas.url}>Icypeas</L> account? On Pro, store its API key in your workspace and searches and
          email finding run on it, with no Meerko credits charged. On Free, Meerko Cloud runs on its own keys and your credits, and keys
          you saved earlier are paused until you upgrade. Self-hosted, your own keys are always free. Meerko checks the key with Icypeas before saving it, stores it encrypted and only
          ever shows its last 4 characters. Add it under Provider keys in Connections, or from the CLI:
        </p>
      </Callout>
      <CodeBlock title="bash" code="pnpm meerko keys set icypeas <key>" lines={[{ text: "$ pnpm meerko keys set icypeas <key>" }]} />

      <H2 id="firecrawl">Find more emails with Firecrawl</H2>
      <p>
        On Pro (or self-hosted), add a <L href={docsSources.firecrawl.url}>Firecrawl</L> key and email finding gets a second step: when Icypeas doesn&apos;t find
        someone&apos;s email, Meerko asks FullEnrich through Firecrawl Alexandria, which checks more sources. It runs on your Firecrawl
        credits (30 per email found; a miss is free), so what it finds costs no Meerko credits, and it keeps working when your Meerko
        credits run out. Rows need a LinkedIn URL, or a first and last name plus a domain or company.
      </p>
      <p>Add it in Connections the same way, or from the CLI:</p>
      <CodeBlock title="bash" code="pnpm meerko keys set firecrawl <key>" lines={[{ text: "$ pnpm meerko keys set firecrawl <key>" }]} />
      <p>
        Meerko checks the key with a free Firecrawl catalog search before saving it. FullEnrich asks you to accept its data terms in
        Firecrawl once; until you do, the step fails with a link to accept them. Its terms only allow marketing to work emails, which is
        all Meerko asks it for. Email verification still runs on Icypeas.
      </p>

      <H2 id="generect">Phone numbers and Generect</H2>
      <p>
        Meerko finds phone numbers through <L href={docsSources.generect.url}>Generect</L>, and asks it for the emails Icypeas (and
        Firecrawl, if you added a key) didn&apos;t find. A missed email found this way costs the usual 8 credits. A phone number costs 80
        credits, only when one is found, and only when you ask for phones: email finding never looks them up. On Meerko Cloud, phones
        are part of Pro. Rows need a LinkedIn URL, or a first and last name plus a company or domain.
      </p>
      <p>
        On Pro or self-hosted, with your own Generect key, phones and missed emails run on your Generect balance instead, with no Meerko credits:
      </p>
      <CodeBlock title="bash" code="pnpm meerko keys set generect <key>" lines={[{ text: "$ pnpm meerko keys set generect <key>" }]} />
      <p>
        Find phones from a table&apos;s Find phones button, <C>pnpm meerko enrich &lt;tableId&gt; --fields phone</C>, or ask your agent.
        Results land in the <C>phone</C> column (E.164, like <C>+14155550123</C>) with its <C>phone_type</C>: <C>mobile</C>,{" "}
        <C>fixed_line</C>, <C>voip</C>, or <C>not_found</C>.
      </p>

      <H2 id="self-hosted">Self-hosted</H2>
      <p>
        Credits are off by default when you <L href="/docs/self-hosting">self-host</L>: everything runs on your own Icypeas key, and{" "}
        <Tool name="get_credits" /> returns no balance.
      </p>
    </DocsShell>
  );
}
