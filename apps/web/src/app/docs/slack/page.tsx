import { CheckCircle2, MessageSquare, ShieldCheck } from "lucide-react";
import { CodeBlock } from "@/components/docs/code-block";
import { DocsShell, docsMetadata } from "@/components/docs/shell";
import { C, Callout, Cards, Fields, H2, L, Step } from "@/components/docs/ui";
import { publicApiUrl } from "@/lib/meerko";
import { slackManifest } from "@/lib/slack";

export const metadata = docsMetadata("slack", "Approve cold email reply drafts from Slack | Meerko docs");

export default function Page() {
  const manifest = slackManifest(publicApiUrl());
  return (
    <DocsShell
      slug="slack"
      lead={
        <p>
          Meerko posts new replies and the drafts your agent wrote to a Slack channel. With the Meerko Slack app, each draft has{" "}
          <strong>Approve and send</strong> and <strong>Discard</strong> buttons, so a reply that lands at night can be answered from your
          phone in the morning.
        </p>
      }
      toc={[
        ["how", "How it works"],
        ["connect", "Connect Slack"],
        ["approving", "Who can approve"],
        ["command", "The /meerko command"],
        ["webhook", "Without the app: an incoming webhook"],
        ["self-hosted", "Self-hosted: create your own Slack app"],
      ]}
    >
      <H2 id="how">How it works</H2>
      <Cards
        items={[
          [MessageSquare, "Drafts, one message each", "Within a minute or two of your agent saving a draft, Meerko posts it with the reply it answers."],
          [CheckCircle2, "Approve where you read it", "Approve sends the draft from your mailbox in the same thread. Edit in Meerko opens the inbox."],
          [ShieldCheck, "Still a person's call", "Your agent can't send. Only a member of your Meerko workspace can press Approve."],
        ]}
      />
      <p>
        Replies without a draft are posted together once they&apos;re 2 minutes old. If you{" "}
        <L href="/docs/wake-your-agent">wake your agent</L> too, Meerko gives it 15 minutes to draft first, so each reply shows up once,
        with its draft. Bounces, out-of-office replies and unsubscribes are never posted. When a draft is approved or discarded anywhere,
        its Slack message shows who did it and loses its buttons.
      </p>

      <H2 id="connect">Connect Slack</H2>
      <Step n={1} id="connect-add" title="Add to Slack">
        <p>
          Under <L href="/app/settings#slack">Settings → Slack</L>, click <strong>Add to Slack</strong>, pick the channel on Slack&apos;s
          page and allow. You&apos;re sent back to Settings.
        </p>
      </Step>
      <Step n={2} id="connect-test" title="Send a test">
        <p>
          Click <strong>Send test</strong>: a message appears in the channel. If the app is removed from Slack, Meerko turns the connection
          off and Settings says why.
        </p>
      </Step>

      <H2 id="approving">Who can approve</H2>
      <p>
        When someone clicks Approve or Discard, Meerko asks Slack for their email and checks it belongs to a member of the Meerko workspace.
        Anyone else in the channel gets a private note and nothing happens. So the Slack email has to match the Google account you sign in
        to Meerko with.
      </p>
      <Callout>
        <p>
          Reply and draft text is shown as plain text, so a prospect&apos;s email can&apos;t mention <C>@channel</C> or hide links in your
          workspace. Every click is checked against Slack&apos;s request signature.
        </p>
      </Callout>

      <H2 id="command">The /meerko command</H2>
      <p>
        <C>/meerko</C> answers privately with the replies waiting, drafts to approve, active sequences and emails sent in the last 24
        hours, with a link to the inbox. <C>/meerko help</C> lists the commands.
      </p>

      <H2 id="webhook">Without the app: an incoming webhook</H2>
      <p>
        Create an <L href="https://api.slack.com/messaging/webhooks">incoming webhook</L> in Slack and paste its URL under Settings →
        Slack. Meerko posts the same messages, with a <strong>Review in Meerko</strong> link instead of buttons, and <C>/meerko</C>{" "}
        isn&apos;t available.
      </p>

      <H2 id="self-hosted">Self-hosted: create your own Slack app</H2>
      <p>
        At <L href="https://api.slack.com/apps">api.slack.com/apps</L>, choose <strong>Create New App → From a manifest</strong>, paste
        this (it points at your API) and install it. Then set the three values on the API server and restart it:
      </p>
      <CodeBlock title="slack-app-manifest.yml" code={manifest} lines={manifest.split("\n").map((text) => ({ text }))} />
      <Fields
        head={["Variable", "From the app's Basic Information page"]}
        rows={[
          [<C key="i">SLACK_CLIENT_ID</C>, "Client ID"],
          [<C key="s">SLACK_CLIENT_SECRET</C>, "Client Secret"],
          [<C key="g">SLACK_SIGNING_SECRET</C>, "Signing Secret"],
        ]}
      />
      <p>Without them, Settings offers only the incoming webhook.</p>
    </DocsShell>
  );
}
