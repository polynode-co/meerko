// Fills a reviewer's workspace with demo data for the Claude Connectors Directory review (issue #88).
//   pnpm db:seed-reviewer <reviewer email>
// First sign in as the reviewer once and connect a test mailbox in the dashboard; then run this against that
// environment's DATABASE_URL. It seeds the reviewer's only workspace and refuses to run twice.
import { createDb, eq, memberships, users, workspaces } from "@meerko/db";
import { ReviewerSeedError, seedReviewerWorkspace } from "./reviewer-seed.ts";

const email = process.argv[2]?.trim().toLowerCase();
if (!email?.includes("@")) {
  console.error("Usage: pnpm db:seed-reviewer <reviewer email>");
  process.exit(1);
}

const db = createDb();
try {
  const owned = await db
    .select({ id: workspaces.id, name: workspaces.name })
    .from(users)
    .innerJoin(memberships, eq(memberships.userId, users.id))
    .innerJoin(workspaces, eq(workspaces.id, memberships.workspaceId))
    .where(eq(users.email, email));
  if (owned.length !== 1) {
    throw new ReviewerSeedError(owned.length ? `${email} is in ${owned.length} workspaces; the reviewer account should have one.` : `No user ${email}: sign in as the reviewer once first.`);
  }
  const ws = owned[0]!;
  const r = await seedReviewerWorkspace(db, ws.id);
  console.log(`Seeded ${ws.name} (${ws.id}) for ${email}:`);
  console.log(`  ${r.leads} leads, a paused sequence (6 enrolled), ${r.replies} replies, ${r.drafts} drafts waiting, ${r.credits} credits, Pro.`);
  console.log(`  Leads are plus-addresses of ${r.mailbox}, so anything sent comes back to that inbox.`);
} catch (err) {
  if (!(err instanceof ReviewerSeedError)) throw err;
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await db.close();
}
