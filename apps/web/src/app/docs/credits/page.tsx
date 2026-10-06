import { KeyRound } from "lucide-react";
import { CodeBlock } from "@/components/docs/code-block";
import { DocsShell, docsMetadata } from "@/components/docs/shell";
import { C, Callout, Fields, H2, L, Tool } from "@/components/docs/ui";
import { docsSources } from "@/lib/sources";

export const metadata = docsMetadata("credits");

export default function Page() {
  return (
    <DocsShell
      slug="credits"
      lead={
        <p>
          On Meerko Cloud, lead search and email finding cost credits. Sending, replies, AI columns and everything else don&apos;t. New
          workspaces start with 1,000 free credits.
        </p>
      }
      toc={[
        ["costs", "What costs credits"],
        ["running-out", "Running out"],
        ["own-key", "Use your own provider key"],
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
          ["Counting search results", "Free"],
          ["Searches and lookups that find nothing", "Free"],
        ]}
      />
      <p>
        AI columns cost nothing because your own agent answers them. Plans and prices are on the <L href="/pricing">pricing page</L>. Check
        your balance with <Tool name="get_credits" />, <C>pnpm meerko credits</C> or the dashboard&apos;s Settings.
      </p>

      <H2 id="running-out">Running out</H2>
      <p>
        A search saves as many results as your balance pays for. Email finding stops when credits run out and says so; the rows it
        didn&apos;t reach are picked up next time. The <C>find-leads</C> command checks your balance first and asks before spending more
        than 500.
      </p>

      <H2 id="own-key">Use your own provider key</H2>
      <Callout icon={KeyRound}>
        <p>
          Have an <L href={docsSources.icypeas.url}>Icypeas</L> account? Store its API key in your workspace and searches and email finding
          run on it, with no Meerko credits charged. Meerko checks the key with Icypeas before saving it, stores it encrypted and only
          ever shows its last 4 characters.
        </p>
      </Callout>
      <CodeBlock title="bash" code="pnpm meerko keys set icypeas <key>" lines={[{ text: "$ pnpm meerko keys set icypeas <key>" }]} />

      <H2 id="self-hosted">Self-hosted</H2>
      <p>
        Credits are off by default when you <L href="/docs/self-hosting">self-host</L>: everything runs on your own Icypeas key, and{" "}
        <Tool name="get_credits" /> returns no balance.
      </p>
    </DocsShell>
  );
}
