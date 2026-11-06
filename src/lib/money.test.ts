import { describe, expect, it } from "vitest";
import { formatCad, sumCents, toCents } from "./money";

describe("toCents", () => {
  it.each([
    ["250.31", 25031],
    ["250.3", 25030],
    ["250", 25000],
    ["0.005", 1],
    ["0.004", 0],
    ["-12.50", -1250],
    ["", 0],
    [null, 0],
    [undefined, 0],
    [250.31, 25031],
    [0.1 + 0.2, 30], // float noise must not leak into cents
    [1000, 100000],
  ])("%j -> %j", (input, expected) => {
    expect(toCents(input as never)).toBe(expected);
  });
});

describe("sumCents / formatCad", () => {
  it("adds without float drift", () => {
    expect(sumCents([toCents("0.10"), toCents("0.20")])).toBe(30);
  });
  it("formats", () => {
    expect(formatCad(123456789)).toBe("$1,234,567.89");
    expect(formatCad(-5)).toBe("-$0.05");
    expect(formatCad(0)).toBe("$0.00");
  });
});
