import { describe, expect, it } from "vitest";
import { describeChange } from "./audit";

describe("describeChange", () => {
  it("lists only the changed fields on an update", () => {
    const before = { id: "1", task: "Pad", quantity: 20, unit_rate: 150, updated_at: "a" };
    const after = { id: "1", task: "Pad", quantity: 25, unit_rate: 150, updated_at: "b" };
    expect(describeChange("UPDATE", before, after)).toBe("quantity: 20 -> 25");
  });

  it("shows several changes and null as 'none'", () => {
    expect(describeChange("UPDATE", { a: null, b: "x" }, { a: 1, b: "y" })).toBe("a: none -> 1; b: x -> y");
  });

  it("truncates long values", () => {
    const long = "x".repeat(100);
    expect(describeChange("UPDATE", { n: "" }, { n: long })).toBe(`n: none -> ${"x".repeat(45)}...`.replace("none", ""));
  });

  it("summarises an insert from the first few meaningful fields", () => {
    const out = describeChange("INSERT", null, { id: "1", site_id: "s", task: "Pad", quantity: 20, unit: "t", unit_rate: 150, notes: null, extra: "e" });
    expect(out).toBe("task: Pad; quantity: 20; unit: t; unit_rate: 150");
  });

  it("summarises a delete from the old row", () => {
    expect(describeChange("DELETE", { id: "1", statement: "care_susp_aband" }, null)).toBe("statement: care_susp_aband");
  });

  it("reports an update that changed nothing visible", () => {
    expect(describeChange("UPDATE", { updated_at: "a", x: 1 }, { updated_at: "b", x: 1 })).toBe("no visible change");
  });
});
