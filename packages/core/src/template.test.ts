import { describe, expect, it } from "vitest";
import { renderTemplate, templateVars } from "./template.ts";

describe("renderTemplate", () => {
  it("fills variables and blanks out missing ones", () => {
    expect(renderTemplate("Hi {{first_name}} at {{ company }}{{missing}}!", { first_name: "Pia", company: "Slalom", missing: null })).toBe(
      "Hi Pia at Slalom!",
    );
    expect(renderTemplate("{{n}} / {{tags}}", { n: 12, tags: ["a", "b"] })).toBe('12 / ["a","b"]');
  });

  it("lists referenced variables once", () => {
    expect(templateVars("{{a}} {{b}} {{a}}")).toEqual(["a", "b"]);
  });
});
