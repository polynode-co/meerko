import { approvalWaiting, creditsLow, mailboxDisconnected, welcome } from "./notices.ts";
import { onboardingConnectMailbox, onboardingStartSequence, onboardingStuckConnecting, onboardingTwoSteps } from "./onboarding.ts";
import { SENDERS, type LifecycleEmail, type PostHogEnv } from "./types.ts";
import type { SyncEmail } from "./posthog-sync.ts";

export type { LifecycleEmail, PostHogEnv } from "./types.ts";

/** Every lifecycle email, in the order a new user meets them. */
export const LIFECYCLE_EMAILS: readonly LifecycleEmail[] = [
  welcome,
  onboardingConnectMailbox,
  onboardingStartSequence,
  onboardingTwoSteps,
  onboardingStuckConnecting,
  approvalWaiting,
  mailboxDisconnected,
  creditsLow,
];

/** What the sync pushes for one env: the artifact's entries, resolved to that env's target. */
export function syncEmails(templates: readonly ArtifactEmail[], env: PostHogEnv): SyncEmail[] {
  return templates.map((t) => ({ ...t, target: t.targets[env] ?? null }));
}

/** One entry of `apps/api/posthog/email-templates.json`. */
export type ArtifactEmail = Omit<LifecycleEmail, "sender"> & { fromName: string; replyTo: string | null };

export function renderArtifact(): string {
  const payload = {
    note:
      "GENERATED FILE, do not edit. Source: apps/api/src/lifecycle/. Regenerate with " +
      "`UPDATE_LIFECYCLE_EMAILS=1 pnpm --filter @meerko/api exec vitest run src/lifecycle`; " +
      "compare with PostHog with `pnpm --filter @meerko/api posthog-emails`.",
    templates: LIFECYCLE_EMAILS.map(({ sender, ...email }): ArtifactEmail => ({
      ...email,
      fromName: SENDERS[sender].name,
      replyTo: SENDERS[sender].replyTo,
    })),
  };
  return `${JSON.stringify(payload, null, 2)}\n`;
}
