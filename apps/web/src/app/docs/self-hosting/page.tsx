import { CodeBlock } from "@/components/docs/code-block";
import { DocsShell, docsMetadata } from "@/components/docs/shell";
import { C, Callout, Fields, H2, L, Step } from "@/components/docs/ui";
import { docsSources } from "@/lib/sources";
import { site } from "@/lib/site";

export const metadata = docsMetadata("self-hosting", "Self-host Meerko, the open-source AI sales agent | Meerko docs");

const sh = (cmds: string[], title = "bash") => <CodeBlock title={title} code={cmds.join("\n")} lines={cmds.map((c) => ({ text: c.startsWith("#") ? c : `$ ${c}`, tone: c.startsWith("#") ? "muted" : undefined }))} />;

export default function Page() {
  return (
    <DocsShell
      slug="self-hosting"
      h1="Self-host Meerko"
      lead={
        <p>
          Run the whole of Meerko yourself: the API, the background worker that sends and reads email, the web dashboard and Postgres.
          It&apos;s the same code as Meerko Cloud, under AGPL-3.0. Credits are off, so lead search and enrichment run on your own
          provider key.
        </p>
      }
      toc={[
        ["what-runs", "What you'll run"],
        ["install", "Install"],
        ["database", "Start the database"],
        ["run", "Run Meerko"],
        ["google", "Connect a mailbox"],
        ["search", "Turn on lead search"],
        ["env", "Environment variables"],
        ["agent", "Connect your agent"],
        ["docker", "Run it all with Docker"],
        ["production", "Running it in production"],
        ["updating", "Updating"],
      ]}
    >
      <H2 id="what-runs">What you&apos;ll run</H2>
      <Fields
        head={["Piece", "What it does"]}
        rows={[
          ["Postgres", <>All your data. <C>docker-compose.yml</C> runs Postgres 17 on port 54329.</>],
          ["API · :8787", "Everything the CLI, agents and the dashboard call, including the MCP server at /mcp. Also signs apps in (OAuth) and serves unsubscribe links."],
          ["Worker", "Sends due emails every 30 seconds (at most one per mailbox per pass) and scans for replies every 2 minutes."],
          ["Web · :3000", "The dashboard: leads, sequences, the inbox and settings."],
        ]}
      />
      <p>You need Node 20 or later, pnpm and Docker.</p>

      <Step n={1} id="install" title="Install">
        {sh([`git clone --branch main ${site.githubUrl} ~/meerko`, "cd ~/meerko", "pnpm install", "cp .env.example .env"])}
        <p>
          <C>main</C> is the released code, the same that runs Meerko Cloud; <C>dev</C> has changes not released yet.{" "}
          <C>.env</C> works as-is for a local install. You&apos;ll fill in the Google and search keys in steps 4 and 5.
        </p>
      </Step>

      <Step n={2} id="database" title="Start the database">
        {sh(["pnpm db:up        # Postgres on localhost:54329", "pnpm db:migrate", "pnpm db:seed      # prints your API key (mk_…)"])}
        <p>
          The seed creates a workspace and an API key named &quot;seed&quot;, and prints the key once. Keep it: the CLI, your agent and the
          dashboard can all log in with it.
        </p>
      </Step>

      <Step n={3} id="run" title="Run Meerko">
        {sh(["pnpm dev"])}
        <p>
          This starts the API on <C>http://localhost:8787</C>, the worker and the dashboard on <C>http://localhost:3000</C>. Open{" "}
          <C>localhost:3000/login</C> and log in with the API key from the seed. To run them one at a time, use{" "}
          <C>pnpm --filter @meerko/api dev</C>, <C>@meerko/worker</C> or <C>@meerko/web</C>.
        </p>
        <p>
          Until <C>MEERKO_ENCRYPTION_KEY</C> is set (step 4), the worker logs &quot;Sender idle&quot; and sends nothing. Tables, imports and AI columns already
          work. Once Google sign-in is on (step 4), the login page offers it instead; the API-key form stays at{" "}
          <C>localhost:3000/login?method=key</C>.
        </p>
      </Step>

      <Step n={4} id="google" title="Connect a mailbox (to send email)">
        <p>
          Meerko sends from Gmail and Google Workspace over IMAP and SMTP with an app password, so sending needs no Google Cloud setup.
          Set a key to encrypt the stored passwords:
        </p>
        {sh(["# generate with: openssl rand -base64 32", "MEERKO_ENCRYPTION_KEY=…"], ".env")}
        <p>
          Restart <C>pnpm dev</C>, then connect a mailbox from Settings in the dashboard, or with <C>pnpm meerko mailboxes connect</C>.
          Both explain how to create the app password; <L href="/docs/mailboxes#connect">Mailboxes</L> has the details.
        </p>
        <Callout>
          <p>
            Never change <C>MEERKO_ENCRYPTION_KEY</C> once mailboxes are connected: the stored passwords and tokens can&apos;t be read
            without it.
          </p>
        </Callout>
        <p>
          <strong className="text-fg">Optional: Sign in with Google.</strong> For the dashboard&apos;s &quot;Sign in with Google&quot;,
          create an OAuth client of type <strong className="text-fg">Web application</strong> in a Google Cloud project, with the
          authorized redirect URI <C>http://localhost:8787/auth/google/callback</C>, and put it in <C>.env</C>:
        </p>
        {sh(["GOOGLE_CLIENT_ID=…apps.googleusercontent.com", "GOOGLE_CLIENT_SECRET=…"], ".env")}
        <p>
          Then invite your address with <C>pnpm db:invite you@example.com</C>. With <C>MEERKO_SIGNUP=open</C>, any Google account can
          create a workspace.
        </p>
        <p>
          <strong className="text-fg">Optional: connect mailboxes through Google instead.</strong> The same client can connect Gmail
          through Google&apos;s consent page (the Gmail API) instead of app passwords. Enable the{" "}
          <L href={docsSources.enableApis.url}>Gmail API</L>, add <C>http://localhost:8787/oauth/google/callback</C> to the redirect URIs,
          and set <C>MEERKO_GMAIL_OAUTH=1</C>. If everyone who&apos;ll send works in one Google Workspace organisation, make the consent
          screen <strong className="text-fg">Internal</strong>: Google then needs no verification. An External app in &quot;Testing&quot;
          expires its tokens after 7 days (<L href={docsSources.refreshExpiry.url}>Google&apos;s docs</L>), and Meerko then pauses that
          mailbox until you reconnect it.
        </p>
      </Step>

      <Step n={5} id="search" title="Turn on lead search">
        <p>
          People and company search and email finding run on <L href={docsSources.icypeas.url}>Icypeas</L>. Put your Icypeas API key in{" "}
          <C>ICYPEAS_API_KEY</C> for the whole server, or store one per workspace with <C>pnpm meerko keys set icypeas &lt;key&gt;</C>{" "}
          (needs <C>MEERKO_ENCRYPTION_KEY</C>). Without either, search and enrichment return an error; everything else works, including
          importing your own CSV.
        </p>
      </Step>

      <H2 id="env">Environment variables</H2>
      <p>
        All of them live in <C>.env</C> at the repo root; <C>.env.example</C> has comments for each. Running from source, the
        dashboard (<C>pnpm dev</C>) reads <C>apps/web/.env.local</C> instead, and its defaults work for a local install.
      </p>
      <Fields
        head={["Variable", "What it's for"]}
        rows={[
          ["DATABASE_URL", "Postgres connection string. Required."],
          ["PORT", "The API's port. Default 8787."],
          ["MEERKO_PUBLIC_URL", "The API's public URL: Google redirects, unsubscribe links, and the API and MCP addresses the dashboard shows. Default http://localhost:8787."],
          ["MEERKO_APP_URL", "The dashboard's URL. After connecting Gmail or signing in, the browser comes back here, and apps are approved on its consent page. Required for Google sign-in, agent sign-in and billing; .env.example sets http://localhost:3000."],
          ["MEERKO_API_URL", "Where the dashboard's server, the CLI and the MCP server reach the API. Default http://localhost:8787."],
          ["MEERKO_ENCRYPTION_KEY", "32 bytes, base64. Encrypts mailbox app passwords and tokens, provider keys and unsubscribe links. Required to send, to sign in with Google, for agent sign-in and to store provider keys."],
          ["GOOGLE_CLIENT_ID · GOOGLE_CLIENT_SECRET", "Your OAuth client, for Sign in with Google, and for mailboxes connected through Google's consent page. Not needed to send with app passwords."],
          ["MEERKO_GMAIL_OAUTH", "1 offers Google's consent page (Gmail API) for connecting mailboxes, besides app passwords. Needs the OAuth client and the Gmail API. Off by default."],
          ["MICROSOFT_CLIENT_ID · MICROSOFT_CLIENT_SECRET", "Your app in Microsoft Entra, for connecting Outlook and Microsoft 365 mailboxes (.env.example lists its setup). Without them, Outlook isn't offered."],
          ["MEERKO_SIGNUP", "invite (default): only addresses added with pnpm db:invite can sign in with Google. open: anyone can."],
          ["ICYPEAS_API_KEY", "Lead search and email finding for every workspace on this server."],
          ["MEERKO_CREDITS", "off (default) when self-hosting. on meters search and enrichment in credits, as on Meerko Cloud. Setting up Stripe turns it on."],
          ["MEERKO_TICK_SECRET", "Meerko Cloud only, where a scheduler replaces the worker. Leave it empty."],
          ["STRIPE_*", "Billing, as on Meerko Cloud (see .env.example). Leave them empty: no billing and no plan limits."],
          ["POSTHOG_API_KEY · NEXT_PUBLIC_POSTHOG_KEY", "Product analytics. Leave them empty and nothing is sent anywhere."],
          ["NEXT_PUBLIC_SITE_URL", "The dashboard's public URL, built into its image (Docker builds only). Same as MEERKO_APP_URL."],
        ]}
      />

      <H2 id="agent">Connect your agent</H2>
      <p>
        The API serves the MCP server at <C>http://localhost:8787/mcp</C>. With Google connected (step 4), agents and the CLI sign in with
        the browser, as on Meerko Cloud:
      </p>
      {sh(["claude mcp add --transport http --scope user meerko http://localhost:8787/mcp", "pnpm meerko login"])}
      <p>
        Without Google, use the key from the seed: add <C>--header &quot;Authorization: Bearer mk_…&quot;</C> to the first command, and{" "}
        <C>--key mk_…</C> to the second. More in <L href="/docs/claude-code#other-ways">Claude Code</L> and{" "}
        <L href="/docs/codex-cursor">Codex & Cursor</L>.
      </p>

      <H2 id="docker">Run it all with Docker</H2>
      <p>
        <C>docker-compose.selfhost.yml</C> runs everything in containers: Postgres, the migrations, the API, the worker and the
        dashboard. You need Docker and the <C>.env</C> from step 1, with the encryption key filled in (step 4).
      </p>
      {sh([
        "docker compose -f docker-compose.selfhost.yml up -d --build",
        "docker compose -f docker-compose.selfhost.yml run --rm tools packages/core/src/seed.ts   # prints an API key",
      ])}
      <p>
        The dashboard is on <C>http://localhost:3000</C> and the API on <C>http://localhost:8787</C>, as with <C>pnpm dev</C>, so the
        same Google redirect URIs work. Migrations run on every <C>up</C>. Invite someone with{" "}
        <C>run --rm tools packages/core/src/invite.ts you@example.com</C>.
      </p>

      <H2 id="production">Running it in production</H2>
      <ul className="flex list-disc flex-col gap-2 pl-6">
        <li>
          Serve the API on a public URL and set <C>MEERKO_PUBLIC_URL</C> to it: recipients click unsubscribe links on it, and Google
          redirects to it. Update the OAuth client&apos;s redirect URIs to match.
        </li>
        <li>
          Set <C>MEERKO_APP_URL</C> to the dashboard&apos;s public URL too, and serve both over HTTPS behind a reverse proxy. With
          Docker Compose, point the proxy at ports 3000 and 8787.
        </li>
        <li>
          Or build the images yourself from the repo root: <C>apps/api/Dockerfile</C>, <C>apps/worker/Dockerfile</C> and{" "}
          <C>apps/web/Dockerfile</C>. Each listens on port 8080 (the worker listens on none). The dashboard takes{" "}
          <C>NEXT_PUBLIC_SITE_URL</C> at build time, and <C>MEERKO_API_URL</C> and <C>MEERKO_PUBLIC_URL</C> at runtime.
        </li>
        <li>
          Keep one worker running (more is safe): it sends the emails and finds the replies. On shutdown it finishes the current pass
          first.
        </li>
        <li>
          Outside Docker Compose, run <C>pnpm db:migrate</C> against the production database before each deploy; migrations
          don&apos;t run on start.
        </li>
        <li>Back up Postgres, and the encryption key with it.</li>
      </ul>

      <H2 id="updating">Updating</H2>
      {sh(["git pull", "pnpm install", "pnpm db:migrate"])}
      <p>
        With Docker: <C>git pull</C>, then <C>docker compose -f docker-compose.selfhost.yml up -d --build</C>, which also migrates.
      </p>
    </DocsShell>
  );
}
