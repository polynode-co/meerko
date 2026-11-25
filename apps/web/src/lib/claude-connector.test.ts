import { afterEach, describe, expect, it, vi } from "vitest";
import { claudeAddConnectorUrl } from "./claude-connector";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

describe("claudeAddConnectorUrl", () => {
  it("opens Claude's add-connector form with Meerko's name and URL filled in", () => {
    const url = claudeAddConnectorUrl("https://api.meerko.ai/mcp");
    expect(url).toBe(
      "https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=Meerko&connectorUrl=https%3A%2F%2Fapi.meerko.ai%2Fmcp",
    );
    const params = new URL(url).searchParams;
    expect(params.get("modal")).toBe("add-custom-connector");
    expect(params.get("connectorName")).toBe("Meerko");
    expect(params.get("connectorUrl")).toBe("https://api.meerko.ai/mcp");
  });
});

describe("addToClaudeUrl", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("links a self-hosted install's own MCP server", async () => {
    vi.stubEnv("MEERKO_PUBLIC_URL", "https://meerko.example.com");
    const { addToClaudeUrl } = await import("./meerko");
    const params = new URL(addToClaudeUrl()).searchParams;
    expect(params.get("connectorName")).toBe("Meerko");
    expect(params.get("connectorUrl")).toBe("https://meerko.example.com/mcp");
  });
});
