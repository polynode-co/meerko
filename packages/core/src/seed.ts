// Creates a workspace and prints a fresh API key. Run once after migrating a new database.
import { createDb, workspaces } from "@meerko/db";
import { createApiKey } from "./api-keys.ts";

const name = process.argv[2] ?? "Default workspace";
const db = createDb();
const [workspace] = await db.insert(workspaces).values({ name }).returning();
const { key } = await createApiKey(db, workspace!.id, "seed");
await db.close();

console.log(`Workspace: ${workspace!.name} (${workspace!.id})`);
console.log(`API key:   ${key}`);
console.log(`\nLog in with:  pnpm meerko login --key ${key}`);
