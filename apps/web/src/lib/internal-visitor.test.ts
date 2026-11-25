import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hasInternalDomain } from "./internal-domain";
import {
  INTERNAL_VISITOR_STORAGE_KEY,
  classifyInternalVisitor,
  detectInternalVisitor,
  markInternalVisitor,
  resetInternalVisitorCache,
} from "./internal-visitor";

/** A browser with a URL query and a `localStorage` that can be made to refuse. */
function browser(search: string, initial: Record<string, string> = {}, opts: { blocked?: boolean } = {}) {
  const store = new Map(Object.entries(initial));
  const refuse = () => {
    if (opts.blocked) throw new DOMException("blocked", "SecurityError");
  };
  vi.stubGlobal("window", {
    location: { search },
    localStorage: {
      getItem: (k: string) => (refuse(), store.get(k) ?? null),
      setItem: (k: string, v: string) => (refuse(), void store.set(k, v)),
      removeItem: (k: string) => (refuse(), void store.delete(k)),
    },
  });
  return store;
}

beforeEach(() => resetInternalVisitorCache());
afterEach(() => vi.unstubAllGlobals());

describe("classifyInternalVisitor", () => {
  it("arms with ?internal=1 and disarms with ?internal=0, whatever is stored", () => {
    expect(classifyInternalVisitor({ search: "?internal=1", stored: null })).toEqual({ isInternal: true, persist: "set" });
    expect(classifyInternalVisitor({ search: "?utm_source=x&internal=1", stored: null })).toEqual({ isInternal: true, persist: "set" });
    expect(classifyInternalVisitor({ search: "?internal=0", stored: "1" })).toEqual({ isInternal: false, persist: "clear" });
  });

  it("falls back to the stored flag, and leaves storage alone", () => {
    expect(classifyInternalVisitor({ search: "", stored: "1" })).toEqual({ isInternal: true, persist: "keep" });
    expect(classifyInternalVisitor({ search: "", stored: null })).toEqual({ isInternal: false, persist: "keep" });
    expect(classifyInternalVisitor({ search: "?internal=yes", stored: "true" })).toEqual({ isInternal: false, persist: "keep" });
  });
});

describe("detectInternalVisitor", () => {
  it("is false with no window (server render)", () => {
    expect(detectInternalVisitor()).toBe(false);
  });

  it("persists ?internal=1, so the next page load is internal without the param", () => {
    const store = browser("?internal=1");
    expect(detectInternalVisitor()).toBe(true);
    expect(store.get(INTERNAL_VISITOR_STORAGE_KEY)).toBe("1");

    resetInternalVisitorCache();
    browser("", Object.fromEntries(store));
    expect(detectInternalVisitor()).toBe(true);
  });

  it("forgets the device with ?internal=0", () => {
    const store = browser("?internal=0", { [INTERNAL_VISITOR_STORAGE_KEY]: "1" });
    expect(detectInternalVisitor()).toBe(false);
    expect(store.has(INTERNAL_VISITOR_STORAGE_KEY)).toBe(false);
  });

  it("reads once per page load", () => {
    const store = browser("", { [INTERNAL_VISITOR_STORAGE_KEY]: "1" });
    expect(detectInternalVisitor()).toBe(true);
    store.clear();
    expect(detectInternalVisitor()).toBe(true);
  });

  it("treats blocked storage as not internal, without throwing", () => {
    browser("", {}, { blocked: true });
    expect(detectInternalVisitor()).toBe(false);
    resetInternalVisitorCache();
    browser("?internal=1", {}, { blocked: true });
    expect(detectInternalVisitor()).toBe(true);
  });
});

describe("markInternalVisitor", () => {
  it("arms the device and the current page", () => {
    const store = browser("");
    expect(detectInternalVisitor()).toBe(false);
    markInternalVisitor();
    expect(detectInternalVisitor()).toBe(true);
    expect(store.get(INTERNAL_VISITOR_STORAGE_KEY)).toBe("1");
  });

  it("doesn't undo an explicit ?internal=0 on the same load", () => {
    const store = browser("?internal=0");
    markInternalVisitor();
    expect(detectInternalVisitor()).toBe(false);
    expect(store.has(INTERNAL_VISITOR_STORAGE_KEY)).toBe(false);
  });
});

describe("hasInternalDomain", () => {
  it("matches our domains only", () => {
    expect(hasInternalDomain("someone@polynode.co")).toBe(true);
    expect(hasInternalDomain(" Someone@Meerko.AI ")).toBe(true);
    expect(hasInternalDomain("someone@polynode.com")).toBe(false);
    expect(hasInternalDomain("someone@gmail.com")).toBe(false);
    expect(hasInternalDomain(undefined)).toBe(false);
    expect(hasInternalDomain(null)).toBe(false);
  });
});
