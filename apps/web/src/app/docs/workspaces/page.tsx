import { CodeBlock } from "@/components/lookout/docs/code-block";
import { DocsShell, docsMetadata } from "@/components/lookout/docs/shell";
import { C, H2, L, Tool } from "@/components/lookout/docs/ui";

const CLI = ['meerko workspaces ls', 'meerko workspaces use "Acme"', 'meerko workspaces create "Globex" --use'];

export const metadata = docsMetadata("workspaces");

export default function Page() {
  return (
    <DocsShell
      slug="workspaces"
      lead={
        <p>
          A workspace is one brand: its own tables, mailboxes, sequences, replies and settings. You can have several and move between them.
          They share one plan and one credit balance.
        </p>
      }
      toc={[
        ["dashboard", "In the dashboard"],
        ["agents", "From your agent"],
        ["cli", "From the CLI"],
        ["billing", "Plan and credits"],
        ["api-keys", "API keys"],
      ]}
      tools={["whoami", "list_workspaces", "switch_workspace", "create_workspace", "rename_workspace"]}
    >
      <H2 id="dashboard">In the dashboard</H2>
      <p>
        The workspace name at the top of the sidebar opens a list of your workspaces. Pick one to switch to it, or add a new one, which
        switches you to it straight away. Owners rename a workspace in Settings.
      </p>

      <H2 id="agents">From your agent</H2>
      <p>
        <Tool name="list_workspaces" /> marks the one the connection acts on, and <Tool name="switch_workspace" /> moves it to another.
        Switching moves that one connection only: your browser and other agents stay where they are. <Tool name="whoami" /> says where
        an agent is now, which is worth asking before it sends anything.
      </p>

      <H2 id="cli">From the CLI</H2>
      <CodeBlock
        title="bash"
        code={CLI.join("\n")}
        lines={CLI.map((c) => ({ text: `$ ${c}` }))}
      />
      <p>
        These need the browser sign-in (<C>meerko login</C>).
      </p>

      <H2 id="billing">Plan and credits</H2>
      <p>
        Billing is per person, not per brand. Every workspace you create runs on the plan and <L href="/docs/credits">credits</L> of your
        first one: upgrading to Pro in any of them upgrades them all, and Free&apos;s one mailbox is one across all of them.
      </p>

      <H2 id="api-keys">API keys</H2>
      <p>
        An <L href="/docs/api-keys">API key</L> belongs to the workspace it was made in and can&apos;t switch. Make a key in each workspace
        a script needs.
      </p>
    </DocsShell>
  );
}
