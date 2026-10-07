import { CodeBlock } from "@/components/docs/code-block";
import { DocsShell, docsMetadata } from "@/components/docs/shell";
import { C, H2, L } from "@/components/docs/ui";
import { cli, cliAnchor } from "@/lib/docs";
import { apiUrl } from "@/lib/meerko";

export const metadata = docsMetadata("cli", "Meerko CLI reference | Meerko docs");

// The CLI's own words are lowercase fragments ("list tables"); show them as sentences.
const sentence = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) + (/[.!?)]$/.test(s) ? "" : ".") : "");

export default function Page() {
  const groups = Object.entries(cli.groups);
  return (
    <DocsShell
      slug="cli"
      lead={
        <p>
          Everything Meerko does, from your terminal or a script: {cli.commands.length} commands. This page is generated from the CLI
          itself, so it matches the version in the repo.
        </p>
      }
      toc={[["setup", "Set up"], ["json", "JSON output"], ...groups.map(([g]) => [`cmd-${g}`, g] as [string, string])]}
    >
      <H2 id="setup">Set up</H2>
      <p>
        The CLI runs from a clone of the repo (Node 20+ and pnpm). Log in once: your browser opens, you continue with Google and click{" "}
        <strong className="text-fg">Allow</strong>. The sign-in is saved to <C>~/.meerko/config.json</C>, readable only by you, and renews
        on its own.
      </p>
      <CodeBlock
        title="bash"
        code={`git clone https://github.com/iker-gonzalez/meerko.ai ~/meerko && cd ~/meerko && pnpm install\npnpm meerko login --url ${apiUrl()}`}
        lines={[{ text: "$ git clone https://github.com/iker-gonzalez/meerko.ai ~/meerko && cd ~/meerko && pnpm install" }, { text: `$ pnpm meerko login --url ${apiUrl()}` }]}
      />
      <p>
        Without <C>--url</C> it uses <C>http://localhost:8787</C>, a self-hosted API on this machine. On a server without Google sign-in,
        log in with an <L href="/docs/api-keys">API key</L> instead: <C>--key mk_…</C>. The <C>MEERKO_API_KEY</C> and{" "}
        <C>MEERKO_API_URL</C> environment variables override the saved login. <C>pnpm meerko logout</C> signs out.
      </p>

      <H2 id="json">JSON output</H2>
      <p>
        Add <C>--json</C> before the command for machine-readable output, handy for scripts and agents:{" "}
        <C>pnpm meerko --json tables ls</C>.
      </p>

      {groups.map(([group, description]) => {
        const commands = cli.commands.filter((c) => c.group === group);
        return (
          <section key={group} className="flex flex-col gap-3">
            <H2 id={`cmd-${group}`}>
              <span className="font-mono text-[24px]">{group}</span>
            </H2>
            {commands.length > 1 && <p className="-mt-1">{sentence(description)}</p>}
            <div className="overflow-hidden rounded-xl border border-line">
              {commands.map((c) => (
                <div key={c.usage} id={cliAnchor(c.usage)} className="flex scroll-mt-24 flex-col gap-2 border-t border-line px-[18px] py-3.5 first:border-t-0">
                  <code className="font-mono text-[13.5px] text-accent">{c.usage.replace(/^meerko/, "pnpm meerko")}</code>
                  <p className="text-[14.5px] leading-normal">{sentence(c.description)}</p>
                  {c.options.length > 0 && (
                    <dl className="flex flex-col gap-1 text-[13.5px]">
                      {c.options.map((o) => (
                        <div key={o.flags} className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
                          <dt className="font-mono whitespace-nowrap text-fg sm:w-56 sm:shrink-0">{o.flags}</dt>
                          <dd>
                            {sentence(o.description)}
                            {o.required && <span className="text-accent"> Required.</span>}
                            {"default" in o && o.default !== undefined && <span> Default {String(o.default)}.</span>}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </DocsShell>
  );
}
