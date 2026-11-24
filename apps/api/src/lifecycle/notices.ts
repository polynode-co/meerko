import { APP_URL, button, HI, ikerNote, meerkoNotice, p, SETTINGS_URL } from "./shell.ts";
import type { LifecycleEmail } from "./types.ts";

/**
 * The four workflows added in #38, picked from the funnel (aha = first sequence started, value = first email sent):
 * - welcome: every sign-up, the one email everyone gets;
 * - approval waiting: a sequence started in approve mode whose emails nobody approved within a day, the point where a
 *   started sequence silently sends nothing;
 * - mailbox disconnected: a working mailbox lost its sign-in, so its sequences stop and its replies go unread;
 * - credits low: the balance crossed CREDITS_LOW_AT, before search and enrichment stop.
 *
 * Copy approved by Iker on #38 (2026-11-24). The prd workflows were created from the dev graphs that day as drafts,
 * enabled only after the events they trigger on reach prd. The dev workflows are drafts too: dev has no email sender.
 */

export const welcome: LifecycleEmail = {
  key: "welcome",
  name: "Welcome",
  targets: {
    dev: { workflowId: "01a20e2d-0591-0000-1334-f40ebf559f32", actionId: "email_welcome" },
    prd: { workflowId: "01a20e43-fc0e-0000-6694-2f17618cfe1e", actionId: "email_welcome" },
  },
  sender: "iker",
  category: "marketing",
  subject: "Welcome to Meerko",
  preheader: "What Meerko does, and what to do first.",
  ...ikerNote([
    p(HI),
    p("Thanks for signing up. I'm Iker, and I build Meerko."),
    p("Meerko is outbound for your AI. You tell Claude, ChatGPT or any MCP client who you sell to; Meerko finds the people, finds their emails and sends the sequence from your own inbox. By default you approve every email before it goes out."),
    p("The first step is connecting the mailbox you'll send from."),
    button("Connect a mailbox", `${SETTINGS_URL}?connect=gmail`),
    p("Who are you hoping to reach? Reply and tell me: I read every reply."),
  ]),
};

export const approvalWaiting: LifecycleEmail = {
  key: "approval-waiting",
  name: "Emails waiting for approval",
  targets: {
    dev: { workflowId: "01a20e2d-461b-0000-ca80-6c31d0f5e301", actionId: "email_approval" },
    prd: { workflowId: "01a20e44-3275-0000-69c0-bf6d14c66325", actionId: "email_approval" },
  },
  sender: "iker",
  category: "marketing",
  subject: "Your first emails are waiting for your OK",
  preheader: "Nothing sends until you approve it.",
  ...ikerNote([
    p(HI),
    p("You started a sequence yesterday, but none of its emails have gone out yet: Meerko waits for you to approve each one first."),
    p('Read and approve them in the sequence, or ask your AI: "Show me the emails waiting for approval and approve the ones that look right."'),
    button("Review the emails", `${APP_URL}/sequences/{{ event.properties.sequence_id }}`),
    p("Approving an email sends it when its step is due; each follow-up waits for its own approval. If you'd rather Meerko send on its own, change it in Settings, under Sending."),
  ]),
};

export const mailboxDisconnected: LifecycleEmail = {
  key: "mailbox-disconnected",
  name: "Mailbox disconnected: sending stopped",
  targets: {
    dev: { workflowId: "01a20e2d-8681-0000-5495-43131d2b5454", actionId: "email_disconnected" },
    prd: { workflowId: "01a20e43-bafb-0000-7036-e5a8cdec7ca1", actionId: "email_disconnected" },
  },
  sender: "meerko",
  category: "transactional",
  subject: "Sending stopped: reconnect {{ event.properties.mailbox }}",
  preheader: "Meerko can't sign in to this mailbox anymore.",
  ...meerkoNotice({
    headline: "Your mailbox lost its connection",
    blocks: [
      p("Meerko can no longer sign in to {{ event.properties.mailbox }}, so nothing is sending from it and its replies aren't being read. This usually means its password or app password changed, or its access was revoked."),
      p("Your other mailboxes keep sending. Reconnect this one and its emails pick up where they stopped."),
      button("Reconnect the mailbox", `${SETTINGS_URL}#mailboxes`),
    ],
    why: "You get this because you own the Meerko workspace this mailbox is in.",
    unsubscribe: false,
  }),
};

export const creditsLow: LifecycleEmail = {
  key: "credits-low",
  name: "Credits running low",
  targets: {
    dev: { workflowId: "01a20e2c-861f-0000-f274-a0ac7ecbd068", actionId: "email_credits" },
    prd: { workflowId: "01a20e43-5f82-0000-c0bc-627018c08ce9", actionId: "email_credits" },
  },
  sender: "meerko",
  category: "transactional",
  subject: "You have {{ event.properties.balance }} Meerko credits left",
  preheader: "Add credits before lead search and enrichment stop.",
  ...meerkoNotice({
    headline: "Your credits are running low",
    blocks: [
      p("Your workspace has {{ event.properties.balance }} credits left. A found email costs 5, a verification 1 and each search result 1; misses are free."),
      p("When they run out, lead search and enrichment stop until you add more. Sequences already running keep sending: sending uses no credits."),
      p("Add a credit pack, or move to Pro for credits every month."),
      button("Add credits", `${SETTINGS_URL}#billing`),
    ],
    why: "You get this because you own the Meerko workspace these credits belong to.",
    unsubscribe: false,
  }),
};
