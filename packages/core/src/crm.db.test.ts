import { randomBytes } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createDb, eq, tableRows, workspaces, type Db } from "@meerko/db";
import { connectCrm, CrmError, getCrmConnection, runCrmSyncTick, syncRowsToCrm, type CrmClient, type CrmPerson } from "./crm.ts";
import { advanceStage, moveStage } from "./pipeline.ts";
import { SecretBox } from "./provider-keys.ts";
import { createTable, insertRows, queryRows } from "./tables.ts";

// Needs Postgres: `pnpm db:up && pnpm db:migrate`, then run with DATABASE_URL set.
describe.skipIf(!process.env.DATABASE_URL)("CRM sync (db)", () => {
  const db: Db = process.env.DATABASE_URL ? createDb() : (undefined as never);
  const box = new SecretBox(randomBytes(32).toString("base64"));
  const name = `crm-${randomBytes(4).toString("hex")}`;
  let ws: string;
  let pushed: CrmPerson[][];
  let refuse: boolean;

  const fake: CrmClient = {
    async identify() {
      return { accountName: "HubSpot account 1" };
    },
    async upsert(people) {
      if (refuse) throw new CrmError("HubSpot rejected the token.", "auth");
      pushed.push(people);
      return { ids: new Map(people.map((p) => [p.email, `rec-${p.email}`])), errors: [] };
    },
  };
  const deps = { client: () => fake };

  beforeEach(async () => {
    pushed = [];
    refuse = false;
    ws = (await db.insert(workspaces).values({ name }).returning())[0]!.id;
    await connectCrm(db, box, ws, { provider: "hubspot", token: "pat-na1-secret-1234" }, deps);
  });
  afterAll(async () => {
    await db.delete(workspaces).where(eq(workspaces.name, name));
  });

  it("stores the token encrypted and shows only its last 4", async () => {
    const conn = await getCrmConnection(db, ws);
    expect(conn).toMatchObject({ provider: "hubspot", last4: "1234", accountName: "HubSpot account 1", autoSync: true });
    expect(JSON.stringify(conn)).not.toContain("secret");
  });

  it("auto-syncs contacted leads, once, and again when their stage changes", async () => {
    const t = await createTable(db, ws, { name: "leads" });
    await insertRows(db, ws, t.id, [{ email: "a@x.example", first_name: "A" }, { email: "b@x.example" }, { first_name: "no email" }]);
    const [a, b, c] = await queryRows(db, ws, t.id);

    // Nobody contacted yet: nothing goes.
    await runCrmSyncTick(db, { box, ...deps });
    expect(pushed).toHaveLength(0);

    await advanceStage(db, [a!.id, c!.id], "contacted");
    expect(await runCrmSyncTick(db, { box, ...deps })).toMatchObject({ synced: 1 });
    expect(pushed.flat().map((p) => [p.email, p.stage])).toEqual([["a@x.example", "contacted"]]);
    const [row] = await db.select().from(tableRows).where(eq(tableRows.id, a!.id));
    expect(row!.crmRecordId).toBe("rec-a@x.example");

    // Up to date: the next pass does nothing, not even for the row without an email.
    pushed = [];
    await runCrmSyncTick(db, { box, ...deps });
    expect(pushed).toHaveLength(0);

    await new Promise((r) => setTimeout(r, 10));
    await moveStage(db, ws, t.id, [a!.id], "meeting");
    await runCrmSyncTick(db, { box, ...deps });
    expect(pushed.flat().map((p) => [p.email, p.stage])).toEqual([["a@x.example", "meeting"]]);
    expect(b).toBeTruthy();
  });

  it("syncs a whole table by hand, skipping rows without an email", async () => {
    const t = await createTable(db, ws, { name: "leads" });
    await insertRows(db, ws, t.id, [{ email: "a@x.example" }, { email: "b@x.example" }, { first_name: "no email" }]);
    expect(await syncRowsToCrm(db, box, ws, { tableId: t.id }, deps)).toMatchObject({ synced: 2, skipped: 1, failed: 0, remaining: 0 });
    // Nothing changed since: a second sync pushes nothing.
    expect(await syncRowsToCrm(db, box, ws, { tableId: t.id }, deps)).toMatchObject({ synced: 0, skipped: 0, remaining: 0 });
  });

  it("turns auto-sync off when the CRM refuses the token, until it's reconnected", async () => {
    const t = await createTable(db, ws, { name: "leads" });
    await insertRows(db, ws, t.id, [{ email: "a@x.example" }]);
    const [a] = await queryRows(db, ws, t.id);
    await advanceStage(db, [a!.id], "contacted");
    refuse = true;
    await runCrmSyncTick(db, { box, ...deps });
    expect(await getCrmConnection(db, ws)).toMatchObject({ autoSync: false, lastError: "HubSpot rejected the token." });

    refuse = false;
    await connectCrm(db, box, ws, { provider: "hubspot", token: "pat-na1-new-5678" }, deps);
    expect(await getCrmConnection(db, ws)).toMatchObject({ autoSync: true, lastError: null, last4: "5678" });
    await runCrmSyncTick(db, { box, ...deps });
    expect(pushed.flat().map((p) => p.email)).toEqual(["a@x.example"]);
  });
});
