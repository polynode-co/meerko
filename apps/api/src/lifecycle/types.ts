/**
 * Meerko's lifecycle emails: the ones PostHog Workflows send to Meerko Cloud's own users when a product event says so
 * (signed up, started a sequence, lost a mailbox, ran low on credits). Transactional mail (sign-in links, the daily
 * digest, mailbox holds) stays in core's SystemMailer; these are the behavioural ones.
 *
 * PostHog decides when to send; git owns what is sent. Each email lives here, renders into
 * `apps/api/posthog/email-templates.json` (a test keeps it current), and `pnpm --filter @meerko/api posthog-emails`
 * compares that with the workflow steps PostHog stores, or with `--apply` overwrites them. An edit made in PostHog's
 * editor is lost on the next sync.
 */

/** The two PostHog projects (core-infrastructure `apps/meerko/app/posthog.tf`). */
export type PostHogEnv = "dev" | "prd";

/**
 * The email inside one workflow's email step: `/api/projects/:project/hog_flows/:workflowId/`, then the action with
 * `actionId`. A workflow step holds its own copy of the message, so this is the copy that sends.
 */
export interface WorkflowStep {
  workflowId: string;
  actionId: string;
}

/** Who the email reads as from. Only the display name and reply-to change; the sending address is PostHog's sender. */
export type EmailSender = "iker" | "meerko";

export interface LifecycleEmail {
  /** Stable key, never sent. */
  key: string;
  /** The step's name in PostHog, kept in step so the two read as one thing. */
  name: string;
  /**
   * Where the email lives in each PostHog project. An env without one is "unpublished" there: written here, not yet
   * wired, which the sync reports and doesn't count as drift.
   */
  targets: Partial<Record<PostHogEnv, WorkflowStep>>;
  subject: string;
  /** What the inbox previews. */
  preheader: string;
  /** One HTML fragment (PostHog's editor wraps it in the document), Liquid allowed. */
  html: string;
  /** The plain-text alternative. */
  text: string;
  sender: EmailSender;
  /**
   * PostHog's message category for the step (`message_category_type`). `marketing` respects the recipient's
   * unsubscribe; `transactional` always sends, for notices about the account's own state (decided on #38: mailbox
   * disconnected and credits low).
   */
  category: MessageCategory;
}

export type MessageCategory = "marketing" | "transactional";

/** The From display name and reply-to for each sender. The sync writes both on every step. */
export const SENDERS: Record<EmailSender, { name: string; replyTo: string | null }> = {
  // A note from the founder: replies reach a person.
  iker: { name: "Iker from Meerko", replyTo: "contact@meerko.ai" },
  // A product notice: replies go to the sender's own address.
  meerko: { name: "Meerko", replyTo: null },
};
