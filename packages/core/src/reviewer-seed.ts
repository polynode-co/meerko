// Fills a workspace with demo data for the Claude Connectors Directory reviewers (issue #88): a table of leads,
// a sequence with some history, replies (two with drafts waiting) and credits, so every MCP tool has something to
// act on. Every lead's address is a plus-address of the workspace's own mailbox, so whatever a reviewer sends lands
// back in that inbox and no real person is ever emailed.
import { and, dataTables, enrollments, eq, mailboxes, messages, replyDrafts, sql, tableRows, workspaces, type Db } from "@meerko/db";
import { grantCredits } from "./credits.ts";
import { createSequence, setSequenceStatus } from "./sequences.ts";
import { createTable, insertRows } from "./tables.ts";

export const REVIEWER_TABLE = "Demo leads: B2B SaaS founders";
export const REVIEWER_CREDITS = 2000;

export class ReviewerSeedError extends Error {}

type Lead = { first_name: string; last_name: string; title: string; company: string; website: string; slug: string };

// Fictional people at fictional companies; the websites use the reserved .example TLD.
const LEADS: Lead[] = [
  { first_name: "Maya", last_name: "Okafor", title: "Founder & CEO", company: "Ledgerline", website: "ledgerline.example", slug: "maya" },
  { first_name: "Tomás", last_name: "Rivera", title: "Head of Growth", company: "Shiftboard", website: "shiftboard.example", slug: "tomas" },
  { first_name: "Priya", last_name: "Nair", title: "Co-founder", company: "Quaystack", website: "quaystack.example", slug: "priya" },
  { first_name: "Jonas", last_name: "Berg", title: "VP Sales", company: "Fjordly", website: "fjordly.example", slug: "jonas" },
  { first_name: "Amara", last_name: "Diallo", title: "Founder", company: "Brightdesk", website: "brightdesk.example", slug: "amara" },
  { first_name: "Leo", last_name: "Marchetti", title: "CEO", company: "Pallet Labs", website: "palletlabs.example", slug: "leo" },
  { first_name: "Hana", last_name: "Sato", title: "Head of Partnerships", company: "Kumo Analytics", website: "kumo.example", slug: "hana" },
  { first_name: "Ben", last_name: "Adler", title: "Founder", company: "Tallyhub", website: "tallyhub.example", slug: "ben" },
];

const FIRST_SUBJECT = "{{company}} and outbound, {{first_name}}";
const FIRST_BODY =
  "Hi {{first_name}},\n\nI saw {{company}} is hiring for sales. Meerko lets your AI agent find leads, write the emails and handle the replies, so a small team can run outbound without another tool to babysit.\n\nWorth a 15-minute look?\n\nBest,";
const STEPS = [
  { subject: FIRST_SUBJECT, body: FIRST_BODY },
  { body: "Hi {{first_name}}, bumping this in case it got buried. Happy to send a two-minute video instead of a call.", delayDays: 3 },
  { body: "Last note from me, {{first_name}}. If outbound isn't a priority at {{company}} this quarter, no worries at all.", delayDays: 4 },
];

// The three leads who answered, oldest first. `intent` null leaves one for the reviewer to classify.
const REPLIES: { slug: string; intent: string | null; body: string; draft?: string }[] = [
  {
    slug: "maya",
    intent: null,
    body: "Hi, thanks for reaching out. Does this work with Claude, or only ChatGPT? We live in Claude all day.",
    draft: "Hi Maya, it works with Claude: Meerko is an MCP connector, so you add it once and Claude can search leads, run sequences and answer replies from the chat. Want me to send the two-line setup?",
  },
  {
    slug: "tomas",
    intent: "question",
    body: "Interesting. What does it cost for a team of three, and can we bring our own Gmail inboxes?",
    draft: "Hi Tomás, yes: you connect your own Gmail or Outlook inboxes and Meerko sends from them. Pro is $49 a month, and there's a free tier to try it first. Happy to walk you through it this week.",
  },
  {
    slug: "priya",
    intent: "interested",
    body: "Yes, let's talk. Thursday afternoon works for me.",
  },
];

/** Gmail and most providers deliver `name+tag@domain` to `name@domain`. */
const plusAddress = (mailbox: string, tag: string) => {
  const [local, domain] = mailbox.split("@");
  return `${local!.split("+")[0]}+${tag}@${domain}`;
};

const fill = (text: string, lead: Lead) => text.replace(/\{\{(\w+)\}\}/g, (_, k: string) => String(lead[k as keyof Lead] ?? ""));

/**
 * Seeds `workspaceId` for review. Uses the workspace's mailbox (connect a test inbox first), comps Pro so no plan
 * limit gets in the way, and refuses to run twice. `now` anchors the fake history.
 */
export async function seedReviewerWorkspace(db: Db, workspaceId: string, now = new Date()) {
  const [mailbox] = await db
    .select()
    .from(mailboxes)
    .where(and(eq(mailboxes.workspaceId, workspaceId), eq(mailboxes.status, "active")))
    .orderBy(mailboxes.createdAt)
    .limit(1);
  if (!mailbox) throw new ReviewerSeedError("Connect a test mailbox to this workspace first (Dashboard → Mailboxes); the demo leads are its plus-addresses.");
  const [existing] = await db
    .select({ id: dataTables.id })
    .from(dataTables)
    .where(and(eq(dataTables.workspaceId, workspaceId), eq(dataTables.name, REVIEWER_TABLE)));
  if (existing) throw new ReviewerSeedError(`This workspace is already seeded (table "${REVIEWER_TABLE}").`);

  await db.update(workspaces).set({ plan: "pro" }).where(eq(workspaces.id, workspaceId));
  await grantCredits(db, workspaceId, REVIEWER_CREDITS, "reviewer_seed");

  // Columns are inferred from the rows, as an import would.
  const table = await createTable(db, workspaceId, { name: REVIEWER_TABLE });
  const emailOf = (l: Lead) => plusAddress(mailbox.email, l.slug);
  await insertRows(
    db,
    workspaceId,
    table.id,
    LEADS.map(({ slug: _, ...l }, i) => ({ ...l, email: emailOf(LEADS[i]!) })),
  );
  const rows = await db.select({ id: tableRows.id, email: sql<string>`${tableRows.data}->>'email'` }).from(tableRows).where(eq(tableRows.tableId, table.id));
  const rowOf = (l: Lead) => rows.find((r) => r.email === emailOf(l))!.id;

  const seq = await createSequence(db, workspaceId, { tableId: table.id, mailboxIds: [mailbox.id], name: "Founders: agent-run outbound", steps: STEPS });

  // The first six leads got step 1 three days ago; the last two are left for the reviewer to enroll.
  const day = 86_400_000;
  const sentAt = new Date(now.getTime() - 3 * day);
  const repliedAt = new Date(now.getTime() - 2 * day);
  for (const [i, lead] of LEADS.slice(0, 6).entries()) {
    const reply = REPLIES.find((r) => r.slug === lead.slug);
    const rfc = `<seed-${lead.slug}-${seq.id.slice(0, 8)}@meerko.ai>`;
    const [en] = await db
      .insert(enrollments)
      .values({
        sequenceId: seq.id,
        rowId: rowOf(lead),
        mailboxId: mailbox.id,
        email: emailOf(lead),
        state: reply ? "replied" : "active",
        nextStep: 1,
        nextSendAt: reply ? null : new Date(now.getTime() + day + i * 600_000),
        messageIds: [rfc],
        createdAt: sentAt,
      })
      .returning();
    const subject = fill(FIRST_SUBJECT, lead);
    await db.insert(messages).values({
      workspaceId,
      mailboxId: mailbox.id,
      enrollmentId: en!.id,
      direction: "out",
      step: 0,
      rfcMessageId: rfc,
      fromEmail: mailbox.email,
      toEmail: emailOf(lead),
      subject,
      body: fill(FIRST_BODY, lead),
      sentAt: new Date(sentAt.getTime() + i * 600_000),
    });
    await db
      .update(tableRows)
      .set({ stage: reply ? "replied" : "contacted", stageChangedAt: reply ? repliedAt : sentAt })
      .where(eq(tableRows.id, rowOf(lead)));
    if (!reply) continue;
    const [inbound] = await db
      .insert(messages)
      .values({
        workspaceId,
        mailboxId: mailbox.id,
        enrollmentId: en!.id,
        direction: "in",
        rfcMessageId: `<seed-reply-${lead.slug}-${seq.id.slice(0, 8)}@${lead.website}>`,
        fromEmail: emailOf(lead),
        toEmail: mailbox.email,
        subject: `Re: ${subject}`,
        body: reply.body,
        intent: reply.intent,
        // Already announced, so the seed doesn't ping the workspace's agent or Slack.
        agentNotifiedAt: repliedAt,
        slackNotifiedAt: repliedAt,
        sentAt: new Date(repliedAt.getTime() + i * 600_000),
      })
      .returning();
    if (reply.draft) await db.insert(replyDrafts).values({ workspaceId, replyId: inbound!.id, body: reply.draft, slackNotifiedAt: repliedAt });
  }
  // Paused: nothing goes out until the reviewer starts it.
  await setSequenceStatus(db, workspaceId, seq.id, "paused");

  return { tableId: table.id, sequenceId: seq.id, mailbox: mailbox.email, leads: LEADS.length, replies: REPLIES.length, drafts: REPLIES.filter((r) => r.draft).length, credits: REVIEWER_CREDITS };
}
