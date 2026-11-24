// Gives an email address access to an existing workspace (issue #25), so a directory reviewer who signs in with
// their own address through the email sign-in link lands in a ready demo workspace.
//   pnpm db:add-member <existing member email> <new email> [--role member|owner]
//   pnpm db:add-member <existing member email> <email> --remove
// Run it against an environment's DATABASE_URL. The workspace is the only one of the existing member; with several
// it refuses. The new user is created if needed, as a first email sign-in would. It sends no email, and running it
// again changes nothing.
import { parseArgs } from "node:util";
import { createDb, ROLES, type Role } from "@meerko/db";
import { addWorkspaceMember, removeWorkspaceMember, WorkspaceMemberError } from "./workspace-members.ts";

const USAGE = `Usage:
  pnpm db:add-member <existing member email> <new email> [--role member|owner]
  pnpm db:add-member <existing member email> <email> --remove`;

const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

const parsed = (() => {
  try {
    return parseArgs({
      args: process.argv.slice(2).filter((a) => a !== "--"),
      allowPositionals: true,
      options: { role: { type: "string" }, remove: { type: "boolean", default: false } },
    });
  } catch (err) {
    return fail(`${(err as Error).message}\n${USAGE}`);
  }
})();
const [memberEmail, email] = parsed.positionals;
const { remove } = parsed.values;
const role = (parsed.values.role ?? "member") as Role;
if (parsed.positionals.length !== 2 || !memberEmail?.includes("@") || !email?.includes("@")) fail(USAGE);
if (!ROLES.includes(role)) fail(`--role must be one of: ${ROLES.join(", ")}.\n${USAGE}`);
if (remove && parsed.values.role) fail(`--remove takes no --role.\n${USAGE}`);

const db = createDb();
try {
  if (remove) {
    const r = await removeWorkspaceMember(db, memberEmail!, email!);
    const where = `${r.workspace.name} (${r.workspace.id})`;
    if (r.status === "not_member") {
      console.log(`${r.email} isn't a member of ${where}. Nothing to remove.`);
    } else {
      console.log(`Removed ${r.email} from ${where}, with their sessions and connected apps on it.`);
      console.log(
        r.workspacesLeft
          ? `They are still in ${r.workspacesLeft} other workspace${r.workspacesLeft === 1 ? "" : "s"}.`
          : "Their user stays, with no workspace: where signup is by invitation they can no longer sign in.",
      );
    }
  } else {
    const r = await addWorkspaceMember(db, memberEmail!, email!, role);
    const where = `${r.workspace.name} (${r.workspace.id})`;
    console.log(r.userCreated ? `Created the user ${r.email}.` : `${r.email} already has a user.`);
    if (r.status === "added") console.log(`Added ${r.email} to ${where} as ${r.role}.`);
    else console.log(`${r.email} is already in ${where} as ${r.role}. Nothing changed.${r.role === role ? "" : ` To make them ${role}, run it with --remove and then again.`}`);
    if (r.signsInto.id === r.workspace.id) console.log("Their email sign-in link lands in that workspace.");
    else console.log(`They were in ${r.signsInto.name} (${r.signsInto.id}) first, so sign-in lands there; they switch to ${r.workspace.name} from the workspace menu.`);
  }
} catch (err) {
  if (!(err instanceof WorkspaceMemberError)) throw err;
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await db.close();
}
