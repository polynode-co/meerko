// Lets an email into a workspace via "Sign in with Google" (an operator tool until there's an invite UI).
//   pnpm db:invite <email> [workspace id or name] [owner|member]
// The workspace can be left out when the database has only one.
import { createDb, eq, ROLES, workspaces, type Role } from "@meerko/db";
import { inviteToWorkspace } from "./auth.ts";

const [email, workspaceArg, roleArg = "owner"] = process.argv.slice(2);
if (!email?.includes("@") || !ROLES.includes(roleArg as Role)) {
  console.error("Usage: pnpm db:invite <email> [workspace id or name] [owner|member]");
  process.exit(1);
}

const db = createDb();
const all = await db.select().from(workspaces);
const matches = workspaceArg ? all.filter((w) => w.id === workspaceArg || w.name === workspaceArg) : all;
if (matches.length !== 1) {
  console.error(matches.length ? "Several workspaces match; pass its id:" : "No matching workspace. Workspaces:");
  for (const w of matches.length ? matches : all) console.error(`  ${w.id}  ${w.name}`);
  await db.close();
  process.exit(1);
}

const workspace = matches[0]!;
const result = await inviteToWorkspace(db, workspace.id, email, roleArg as Role);
await db.close();
console.log(
  result.status === "added"
    ? `${result.email} is now ${roleArg} of ${workspace.name}.`
    : `Invited ${result.email} to ${workspace.name} as ${roleArg}. They get access on their first Google sign-in.`,
);
