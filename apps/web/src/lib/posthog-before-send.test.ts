import type { CaptureResult } from "posthog-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { INTERNAL_VISITOR_STORAGE_KEY, resetInternalVisitorCache } from "./internal-visitor";
import { createBeforeSend, surfaceFor } from "./posthog-before-send";

function browser(search: string, stored: string | null = null) {
  vi.stubGlobal("window", {
    location: { search },
    localStorage: {
      getItem: (k: string) => (k === INTERNAL_VISITOR_STORAGE_KEY ? stored : null),
      setItem: () => {},
      removeItem: () => {},
    },
  });
}

const ctx = { appEnv: "prd", country: "ES", release: "abc123", pathname: () => "/app/inbox" };
const event = (properties: Record<string, unknown> = {}, extra: Partial<CaptureResult> = {}) =>
  ({ uuid: "u1", event: "$pageview", properties, ...extra }) as CaptureResult;

beforeEach(() => resetInternalVisitorCache());
afterEach(() => vi.unstubAllGlobals());

describe("createBeforeSend", () => {
  it("stamps is_internal: true on every event while the flag is armed, cookieless ones included", () => {
    browser("", "1");
    const send = createBeforeSend(ctx);
    const cookieless = send(event({ distinct_id: "cookieless_abc", $cookieless_mode: true }));
    const identified = send(event({ distinct_id: "user_1" }, { event: "sign_in_clicked" }));
    expect(cookieless?.properties).toMatchObject({ distinct_id: "cookieless_abc", is_internal: true });
    expect(identified?.properties).toMatchObject({ distinct_id: "user_1", is_internal: true });
  });

  it("stamps is_internal: false, never leaves it out, for everyone else", () => {
    browser("");
    expect(createBeforeSend(ctx)(event())?.properties).toHaveProperty("is_internal", false);
  });

  it("arms from ?internal=1 on the first event", () => {
    browser("?internal=1");
    expect(createBeforeSend(ctx)(event())?.properties.is_internal).toBe(true);
  });

  it("tags, never drops: the event and its own properties go through", () => {
    browser("", "1");
    const out = createBeforeSend(ctx)(event({ $current_url: "https://meerko.ai/app" }));
    expect(out).not.toBeNull();
    expect(out?.event).toBe("$pageview");
    expect(out?.properties).toMatchObject({ $current_url: "https://meerko.ai/app" });
  });

  it("keeps the other stamps: app_env, surface, country, release", () => {
    browser("");
    expect(createBeforeSend(ctx)(event())?.properties).toMatchObject({ app_env: "prd", surface: "app", country: "ES", $release: "abc123" });
    const bare = createBeforeSend({ ...ctx, country: null, release: undefined, pathname: () => "/pricing" })(event())?.properties;
    expect(bare).toMatchObject({ surface: "marketing" });
    expect(bare).not.toHaveProperty("country");
    expect(bare).not.toHaveProperty("$release");
  });

  it("passes a null event through", () => {
    expect(createBeforeSend(ctx)(null)).toBeNull();
  });
});

describe("surfaceFor", () => {
  it("splits the dashboard from the marketing site", () => {
    expect(surfaceFor("/app")).toBe("app");
    expect(surfaceFor("/app/leads")).toBe("app");
    expect(surfaceFor("/oauth/consent")).toBe("app");
    expect(surfaceFor("/apply")).toBe("marketing");
    expect(surfaceFor("/")).toBe("marketing");
  });
});
