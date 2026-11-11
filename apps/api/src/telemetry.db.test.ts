import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { installId, sendTelemetryPing, telemetryEnabled } from "@meerko/core";
import { createDb, eq, workspaces, type Db } from "@meerko/db";
import type { Analytics, CaptureInput } from "./analytics.ts";
import { createApp } from "./app.ts";

// Opt-in self-host install count: the worker's ping (core/telemetry.ts) and the API endpoint that counts it.
describe.skipIf(!process.env.DATABASE_URL)("self-host telemetry (db)", () => {
  const db: Db = process.env.DATABASE_URL ? createDb() : (undefined as never);
  const captured: CaptureInput[] = [];
  const analytics: Analytics = {
    posthog: null,
    common: { app_env: "test" },
    capture: async (input) => void captured.push(input),
    captureException: async () => {},
  };
  const app = createApp(db, { analytics });
  // installId() hashes the oldest workspace, so a fresh test database needs one (and returns null before it exists).
  let ws: string | undefined;
  beforeAll(async () => {
    ws = (await db.insert(workspaces).values({ name: "telemetry-test" }).returning())[0]!.id;
  });
  afterAll(async () => {
    if (ws) await db.delete(workspaces).where(eq(workspaces.id, ws));
  });

  it("is off unless MEERKO_TELEMETRY is set", () => {
    expect(telemetryEnabled({})).toBe(false);
    expect(telemetryEnabled({ MEERKO_TELEMETRY: "0" })).toBe(false);
    expect(telemetryEnabled({ MEERKO_TELEMETRY: "1" })).toBe(true);
  });

  it("sends only a stable hashed install id, and the API counts it with no person profile", async () => {
    const id = await installId(db);
    expect(id).toMatch(/^[0-9a-f]{64}$/);
    expect(await installId(db)).toBe(id);

    const bodies: unknown[] = [];
    const viaApp: typeof fetch = async (url, init) => {
      bodies.push(JSON.parse(String(init?.body)));
      return app.request(new URL(String(url)).pathname, init);
    };
    expect(await sendTelemetryPing(db, { url: "https://api.example/telemetry/ping", fetch: viaApp })).toBe(true);
    expect(bodies).toEqual([{ install_id: id }]);
    expect(captured.at(-1)).toEqual({ distinctId: `install:${id}`, event: "self_host_pinged", properties: { $process_person_profile: false } });
  });

  it("rejects anything but a sha256 install id", async () => {
    const post = (body: unknown) => app.request("/telemetry/ping", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const before = captured.length;
    expect((await post({ install_id: "not-a-hash" })).status).toBe(400);
    expect((await post({ email: "someone@example.com" })).status).toBe(400);
    expect(captured.length).toBe(before);
  });

  it("never throws when the endpoint is down", async () => {
    const down: typeof fetch = async () => {
      throw new Error("offline");
    };
    expect(await sendTelemetryPing(db, { fetch: down })).toBe(false);
  });
});
