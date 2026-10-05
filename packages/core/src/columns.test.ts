import { describe, expect, it } from "vitest";
import { coerceRow, inferColumnType, inferNewColumns, normalizeRow, toColumnKey } from "./columns.ts";

describe("toColumnKey", () => {
  it("normalizes headers", () => {
    expect(toColumnKey("First Name")).toBe("first_name");
    expect(toColumnKey("  LinkedIn URL ")).toBe("linkedin_url");
    expect(toColumnKey("%%%")).toBe("column");
  });
});

describe("inferColumnType", () => {
  it("detects common types and ignores blanks", () => {
    expect(inferColumnType(["ana@acme.com", "", "bo@x.io"])).toBe("email");
    expect(inferColumnType(["https://acme.com", "www.x.io"])).toBe("url");
    expect(inferColumnType(["12", 3, "4.5"])).toBe("number");
    expect(inferColumnType(["true", false])).toBe("boolean");
    expect(inferColumnType(["Ana", "12"])).toBe("text");
    expect(inferColumnType([])).toBe("text");
  });
});

describe("inferNewColumns", () => {
  it("only returns columns the table doesn't already have", () => {
    const rows = [normalizeRow({ "First Name": "Ana", Email: "ana@acme.com" }), normalizeRow({ Email: "bo@x.io" })];
    const added = inferNewColumns([{ key: "first_name", name: "First Name", type: "text" }], rows);
    expect(added).toEqual([{ key: "email", name: "email", type: "email" }]);
  });
});

describe("coerceRow", () => {
  it("converts strings to the column type and blanks to null", () => {
    const columns = [
      { key: "employees", name: "Employees", type: "number" as const },
      { key: "active", name: "Active", type: "boolean" as const },
      { key: "name", name: "Name", type: "text" as const },
    ];
    expect(coerceRow({ employees: "120", active: "true", name: "Ana", note: " " }, columns)).toEqual({
      employees: 120,
      active: true,
      name: "Ana",
      note: null,
    });
  });
});
