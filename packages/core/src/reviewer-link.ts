// Creates or revokes a directory reviewer's sign-in link (issue #160): a secret URL that signs in as one account
// without Google, for the Claude and ChatGPT directory reviews.
//   pnpm db:reviewer-link create <reviewer email> [--days 60] [--app-url https://…]
//   pnpm db:reviewer-link revoke <reviewer email> [--sign-out]
// Run it against an environment's DATABASE_URL, after signing in as the reviewer once. `create` prints the URL
// once: only the token's hash is stored, so a lost link is replaced, not recovered. `revoke` ends every link of
// that account; `--sign-out` also ends its dashboard sessions.
import { parseArgs } from "node:util";
import { createDb } from "@meerko/db";
import { createReviewerLink, revokeReviewerLinks, ReviewerLinkError } from "./reviewer-links.ts";

const USAGE = `Usage:
  pnpm db:reviewer-link create <reviewer email> [--days 60] [--app-url https://…]
  pnpm db:reviewer-link revoke <reviewer email> [--sign-out]`;

const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

const parsed = (() => {
  try {
    return parseArgs({
      args: process.argv.slice(2).filter((a) => a !== "--"),
      allowPositionals: true,
      options: { days: { type: "string", default: "60" }, "app-url": { type: "string" }, "sign-out": { type: "boolean", default: false } },
    });
  } catch (err) {
    return fail(`${(err as Error).message}\n${USAGE}`);
  }
})();
const [command, email] = parsed.positionals;
if ((command !== "create" && command !== "revoke") || !email?.includes("@") || parsed.positionals.length !== 2) fail(USAGE);

// The web app the link opens on. Checked before touching the database, so a link is never made and then lost.
const appUrl = parsed.values["app-url"] ?? process.env.MEERKO_APP_URL;
if (command === "create") {
  if (!appUrl || !URL.canParse(appUrl)) fail("Pass --app-url <the web app's URL>, or set MEERKO_APP_URL.");
  if (!/^\d+$/.test(parsed.values.days)) fail(`--days must be a whole number.\n${USAGE}`);
}

const db = createDb();
try {
  if (command === "create") {
    const link = await createReviewerLink(db, email!, Number(parsed.values.days));
    console.log(`Sign-in link for ${link.email}, valid until ${link.expiresAt.toISOString().slice(0, 10)}. It is shown only this once:`);
    console.log(`\n  ${new URL(`/r/${link.token}`, appUrl)}\n`);
    console.log("Anyone with it is signed in as that account. Pass it on privately, never in an issue or a pull request.");
    if (link.others) console.log(`${link.others} earlier link${link.others === 1 ? "" : "s"} for this account still work${link.others === 1 ? "s" : ""}; \`revoke\` ends them all.`);
  } else {
    const r = await revokeReviewerLinks(db, email!, { signOut: parsed.values["sign-out"] });
    console.log(r.revoked ? `Revoked ${r.revoked} link${r.revoked === 1 ? "" : "s"} for ${r.email}.` : `${r.email} had no working link.`);
    if (parsed.values["sign-out"]) console.log(`Ended ${r.sessionsEnded} dashboard session${r.sessionsEnded === 1 ? "" : "s"}.`);
    else console.log("Sessions already started stay signed in for up to 30 days; add --sign-out to end them now.");
  }
} catch (err) {
  if (!(err instanceof ReviewerLinkError)) throw err;
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await db.close();
}
