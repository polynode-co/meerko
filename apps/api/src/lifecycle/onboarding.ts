import { button, HI, ikerNote, p, SETTINGS_URL, APP_URL } from "./shell.ts";
import type { LifecycleEmail, WorkflowStep } from "./types.ts";

/**
 * "Onboarding: first sequence (day 1, 3, 7)", built in PostHog on 2026-11-11 (#116) and live in prd before its copy came
 * into git (#38). Day 1: connect a mailbox (skipped if connected). Day 3, only if no sequence started: one version for
 * people with a mailbox, one without. Day 7: only if still no mailbox. A started sequence ends it.
 *
 * The copy below is what prd held when it moved here, word for word, so the first sync changes nothing that sends.
 */
const PRD = "01a1ca4b-0976-0000-b18f-a6d6bd32dcab";
/** The dev copy, made from this file on 2026-11-24 (draft: dev has no email sender). */
const DEV = "01a20e2e-5170-0000-9aff-816cac26c976";
const at = (actionId: string): Partial<Record<"dev" | "prd", WorkflowStep>> => ({
  prd: { workflowId: PRD, actionId },
  dev: { workflowId: DEV, actionId },
});

const CONNECT_URL = `${SETTINGS_URL}?connect=gmail`;

export const onboardingConnectMailbox: LifecycleEmail = {
  key: "onboarding-day-1-connect-mailbox",
  name: "Day 1: connect your mailbox",
  targets: at("email_1"),
  sender: "iker",
  subject: "Connect a mailbox to send your first sequence",
  preheader: "Two minutes with Gmail, one click with Outlook.",
  ...ikerNote([
    p(HI),
    p("Meerko sends from your own inbox, so the first step is connecting one."),
    p("Gmail or Google Workspace takes about two minutes with an app password. Outlook and Microsoft 365 is one click with Sign in with Microsoft."),
    button("Connect a mailbox", CONNECT_URL),
    p('Then ask your AI something like: "Find 20 leads that fit my ICP and draft a 3-step sequence." By default you approve every email before it sends.'),
  ]),
};

export const onboardingStartSequence: LifecycleEmail = {
  key: "onboarding-day-3-start-sequence",
  name: "Day 3: start your first sequence (mailbox connected)",
  targets: at("email_2a"),
  sender: "iker",
  subject: "Your mailbox is ready. Start your first sequence",
  preheader: "One message to your AI gets it going.",
  ...ikerNote([
    p(HI),
    p("Your mailbox is connected, so you're one step from your first sequence. Ask your AI:"),
    p('"Find 20 leads that fit my ICP, find their emails, and draft a 3-step sequence for them."'),
    p("You'll see every email before it goes out. A new mailbox starts with a few sends a day and ramps up on its own, so it stays out of spam."),
    button("Open Meerko", APP_URL),
  ]),
};

export const onboardingTwoSteps: LifecycleEmail = {
  key: "onboarding-day-3-two-steps",
  name: "Day 3: two steps to your first sequence (no mailbox)",
  targets: at("email_2b"),
  sender: "iker",
  subject: "Your first sequence is two steps away",
  preheader: "Connect a mailbox, then ask your AI.",
  ...ikerNote([
    p(HI),
    p("Getting your first sequence out takes two steps:"),
    p("1. Connect the mailbox you'll send from: about two minutes for Gmail, one click for Outlook."),
    button("Connect a mailbox", CONNECT_URL),
    p('2. Ask your AI: "Find 20 leads that fit my ICP and draft a 3-step sequence." You approve every email before it sends.'),
  ]),
};

export const onboardingStuckConnecting: LifecycleEmail = {
  key: "onboarding-day-7-stuck-connecting",
  name: "Day 7: stuck connecting your mailbox?",
  targets: at("email_3"),
  sender: "iker",
  subject: "Stuck connecting your mailbox?",
  preheader: "The usual blockers, and how to get past them.",
  ...ikerNote([
    p(HI),
    p("You haven't connected a mailbox yet, and that's where most people get stuck. The usual reasons:"),
    p("- Gmail has no App passwords page: 2-Step Verification is off, or a Google Workspace admin has turned app passwords off."),
    p("- Outlook asks for an admin: your IT admin needs to approve Meerko once."),
    button("What to check, and the steps for your admin", "https://meerko.ai/docs/mailboxes#no-app-password"),
    p("Still stuck? Email contact@meerko.ai and I'll help you get connected. This is the last reminder."),
  ]),
};
