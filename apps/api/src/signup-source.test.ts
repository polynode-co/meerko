import { describe, expect, it } from "vitest";
import { signupSource } from "./analytics.ts";

describe("signupSource", () => {
  it("keeps UTM tags, the referring host and the landing path", () => {
    expect(signupSource({ utm_source: "linkedin", utm_campaign: "launch", ref: "News.YCombinator.com", landing: "/guides/ai-sdr" })).toEqual({
      utm_source: "linkedin",
      utm_campaign: "launch",
      referrer_domain: "news.ycombinator.com",
      landing_path: "/guides/ai-sdr",
    });
  });

  it("drops unknown keys, non-paths and odd hosts", () => {
    expect(signupSource({ evil: "x", landing: "https://evil.example", ref: "a b/c", utm_source: ["x"] })).toEqual({});
  });

  it("caps values at 100 characters", () => {
    expect(signupSource({ utm_term: "x".repeat(300) }).utm_term).toHaveLength(100);
  });
});
