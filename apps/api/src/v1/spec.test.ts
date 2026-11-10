import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.ts";
import { buildOpenApi } from "./openapi.ts";
import { REPLIES_SCOPE_ROUTES, V1 } from "./spec.ts";

// Registering routes touches no database, so none is needed to list them.
const app = createApp({} as never);
const registered = app.routes
  .filter((r) => r.path.startsWith("/v1/") && r.method !== "ALL")
  .map((r) => `${r.method} ${r.path.slice("/v1".length)}`);
const specified = V1.map((op) => `${op.method.toUpperCase()} ${op.path}`);

describe("/v1 spec", () => {
  it("describes every route the API registers", () => {
    expect(registered.filter((r) => !specified.includes(r)), "add these routes to apps/api/src/v1/spec.ts").toEqual([]);
  });

  it("describes no route the API doesn't register", () => {
    expect(specified.filter((r) => !registered.includes(r)), "remove these from apps/api/src/v1/spec.ts").toEqual([]);
  });

  it("names each route once", () => {
    const dupes = (xs: string[]) => xs.filter((x, i) => xs.indexOf(x) !== i);
    expect(dupes(specified)).toEqual([]);
    expect(dupes(V1.map((op) => op.id))).toEqual([]);
  });

  it("lets a replies-scoped credential read replies and save drafts, and nothing else", () => {
    // Widening this lets an agent that reads email from strangers send, enroll or spend credits: change it on purpose.
    const allowed = REPLIES_SCOPE_ROUTES.map(([method, re]) => `${method} ${re.source}`);
    expect(allowed).toEqual([
      "GET ^\\/v1\\/me$",
      "GET ^\\/v1\\/replies$",
      "POST ^\\/v1\\/replies\\/[^/]+\\/classify$",
      "POST ^\\/v1\\/replies\\/[^/]+\\/draft$",
      "GET ^\\/v1\\/drafts$",
      // Checking in to an Autopilot run: it records the run and returns the brief, nothing more.
      "POST ^\\/v1\\/routines\\/[^/]+\\/start$",
    ]);
  });

  it("matches the committed OpenAPI document (run `pnpm api:spec`)", () => {
    const committed = readFileSync(new URL("../../../web/public/openapi.json", import.meta.url), "utf8");
    expect(JSON.parse(committed)).toEqual(buildOpenApi());
  });
});
