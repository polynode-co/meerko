import { randomBytes } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createDb, eq, providerKeys, workspaces, type Db } from "@meerko/db";
import { getBalance, grantCredits, InsufficientCreditsError } from "./credits.ts";
import { IcypeasClient } from "./enrichment/icypeas.ts";
import { deleteProviderKey, EncryptionNotConfiguredError, getProviderKey, listProviderKeys, SecretBox, setProviderKey } from "./provider-keys.ts";
import { searchLeads } from "./search.ts";

describe.skipIf(!process.env.DATABASE_URL)("BYOK and search credits (db)", () => {
  const db: Db = process.env.DATABASE_URL ? createDb() : (undefined as never);
  const box = new SecretBox(randomBytes(32).toString("base64"));
  const newWorkspace = async () => (await db.insert(workspaces).values({ name: "byok-test" }).returning())[0]!.id;
  afterAll(async () => {
    await db.delete(workspaces).where(eq(workspaces.name, "byok-test"));
  });

  it("stores keys encrypted, replaces them, and never lists the secret", async () => {
    const ws = await newWorkspace();
    await setProviderKey(db, box, ws, "icypeas", "first-key-1111");
    await setProviderKey(db, box, ws, "icypeas", "second-key-2222");
    expect(await getProviderKey(db, box, ws, "icypeas")).toBe("second-key-2222");
    expect(await listProviderKeys(db, ws)).toMatchObject([{ provider: "icypeas", last4: "2222" }]);

    const [raw] = await db.select().from(providerKeys).where(eq(providerKeys.workspaceId, ws));
    expect(raw!.encryptedKey).not.toContain("second-key");

    await expect(setProviderKey(db, null, ws, "icypeas", "k")).rejects.toBeInstanceOf(EncryptionNotConfiguredError);
    expect(await deleteProviderKey(db, ws, "icypeas")).toBe(true);
    expect(await getProviderKey(db, box, ws, "icypeas")).toBeNull();
  });

  /** Fake Icypeas that returns as many companies as the requested page size. */
  const icypeas = () => {
    const sizes: number[] = [];
    const fetch = (async (_url: string, init: RequestInit) => {
      const { pagination } = JSON.parse(String(init.body));
      sizes.push(pagination.size);
      const leads = Array.from({ length: pagination.size }, (_, i) => ({ name: `Co ${i}` }));
      return Response.json({ success: true, total: 500, leads });
    }) as typeof globalThis.fetch;
    return { client: new IcypeasClient({ apiKey: "k", fetch }), sizes };
  };

  it("charges per result and caps the search at what the balance covers", async () => {
    const ws = await newWorkspace();
    await grantCredits(db, ws, 30, "test");
    const { client, sizes } = icypeas();

    const res = await searchLeads(db, ws, client, { kind: "companies", query: { location: { include: ["ES"] } }, limit: 50 }, { enabled: true });
    expect(sizes).toEqual([30]);
    expect(res).toMatchObject({ inserted: 30, creditsSpent: 30, cappedByCredits: true });
    expect(await getBalance(db, ws)).toBe(0);

    await expect(
      searchLeads(db, ws, client, { kind: "companies", query: { location: { include: ["ES"] } }, limit: 5 }, { enabled: true }),
    ).rejects.toBeInstanceOf(InsufficientCreditsError);
  });

  it("doesn't charge when metering is off (own key or self-host)", async () => {
    const ws = await newWorkspace();
    const { client } = icypeas();
    const res = await searchLeads(db, ws, client, { kind: "companies", query: { location: { include: ["ES"] } }, limit: 10 }, { enabled: false });
    expect(res).toMatchObject({ inserted: 10, creditsSpent: 0 });
    expect(res.cappedByCredits).toBeUndefined();
  });
});
