import { describe, expect, it } from "vitest";
import { signedCents, summarizeCosts } from "./costs";
import { goodContext, line } from "./validation/fixtures";

describe("signedCents", () => {
  it("treats scrap-metal value as a credit and everything else as a cost", () => {
    expect(signedCents(line({ formRowKey: "001-A:ferrous_material_value", quantity: 5, unitRate: 200 }))).toBe(-100000);
    expect(signedCents(line({ formRowKey: "001-A:sorting_and_sizing_cost", quantity: 5, unitRate: 20 }))).toBe(10000);
    expect(signedCents(line({ formRowKey: "001-A:concrete_demolition", quantity: 20, unitRate: 150 }))).toBe(300000);
  });
});

describe("summarizeCosts on the known-good estimate", () => {
  const s = summarizeCosts(goodContext());

  it("totals by workstream (care 36,000 + 25,200 security = 61,200)", () => {
    expect(s.byWorkstream.care_security).toBe(61_200_00);
    expect(s.byWorkstream.suspension).toBe(5_000_00);
    // 20 t x 150 + 15 t x 80 - 5 t x 200 scrap credit
    expect(s.byWorkstream.abandonment).toBe(3_000_00 + 1_200_00 - 1_000_00);
    expect(s.byWorkstream.contingencies).toBe(10_000_00);
    expect(s.byWorkstream.mgmt_admin).toBe(10_000_00);
  });

  it("splits by form and adds up to the grand total", () => {
    expect(s.byForm["001-A"] + s.byForm["001-B"]).toBe(s.grand);
    const sumWs = Object.values(s.byWorkstream).reduce((a, b) => a + b, 0);
    expect(sumWs).toBe(s.grand);
  });

  it("reports the scrap credit separately and has no unassigned lines", () => {
    expect(s.scrapCredit).toBe(1_000_00);
    expect(s.unassigned.count).toBe(0);
  });

  it("groups by template block", () => {
    expect(s.byBlock["001-B"]["off_site_transport_disposal"]).toBe(1800 * 85 * 100);
    expect(s.byBlock["001-A"]["care_and_security"]).toBe(61_200_00);
  });
});

describe("summarizeCosts edge cases", () => {
  it("puts lines with no form row in 'unassigned'", () => {
    const c = goodContext();
    c.workstreams.suspension.lineItems.push(line({ formRowKey: null, unitRate: 250 }));
    const s = summarizeCosts(c);
    expect(s.unassigned).toEqual({ count: 1, cents: 25_000 });
  });

  it("is exact to the cent", () => {
    const c = goodContext();
    c.workstreams.suspension.lineItems = [line({ quantity: 2.5, unitRate: 100.123, total: 250.31 })];
    expect(summarizeCosts(c).byWorkstream.suspension).toBe(25_031);
  });
});
