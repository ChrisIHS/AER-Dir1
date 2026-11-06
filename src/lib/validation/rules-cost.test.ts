import { describe, expect, it } from "vitest";
import { goodContext, line } from "./fixtures";
import { v01NoNpv } from "./rules/v01-no-npv";
import { v02NoSalvage } from "./rules/v02-no-salvage";
import { v03ScrapSupport } from "./rules/v03-scrap-support";
import { v04RateSheetLink } from "./rules/v04-rate-sheet-link";
import { v05ClientDiscount } from "./rules/v05-client-discount";
import { v06RateStaleness } from "./rules/v06-rate-staleness";
import type { Issue, Rule, ValidationContext } from "./types";

const run = (rule: Rule, mutate?: (c: ValidationContext) => void): Issue[] => {
  const c = goodContext();
  mutate?.(c);
  return rule(c);
};
const sig = (issues: Issue[]) => issues.map((i) => `${i.severity}:${i.ruleId}`);

describe("V-01 no NPV / discounting (Req. 4)", () => {
  it("passes on a clean estimate", () => expect(run(v01NoNpv)).toEqual([]));

  it("blocks when the workstream is not attested", () => {
    const r = run(v01NoNpv, (c) => (c.details.abandonment.attestations.noNpvDiscount = false));
    expect(sig(r)).toEqual(["block:V-01"]);
    expect(r[0]!.req).toBe("Req. 4");
    expect(r[0]!.workstream).toBe("abandonment");
  });

  it("does not require attestation for a workstream with no lines", () => {
    const r = run(v01NoNpv, (c) => {
      c.workstreams.suspension.lineItems = [];
      c.details.suspension.attestations.noNpvDiscount = false;
    });
    expect(r).toEqual([]);
  });

  it.each([
    ["discount", { discountPctApplied: 5 }],
    ["escalation", { escalationPctApplied: 2.5 }],
  ] as const)("blocks a line with a %s rate", (_n, over) => {
    const li = line(over);
    const r = run(v01NoNpv, (c) => c.workstreams.suspension.lineItems.push(li));
    expect(sig(r)).toEqual(["block:V-01"]);
    expect(r[0]!.lineItemId).toBe(li.id);
  });

  it("treats a zero rate as no discount", () => {
    expect(run(v01NoNpv, (c) => c.workstreams.suspension.lineItems.push(line({ discountPctApplied: 0 })))).toEqual([]);
  });

  it.each([
    ["Net present value of care costs", true],
    ["Escalated to 2030 dollars", true],
    ["Apply 4% discount rate", true],
    ["Concrete removal", false],
  ])("keyword scan: %j -> warn=%j", (task, warns) => {
    const r = run(v01NoNpv, (c) => c.workstreams.suspension.lineItems.push(line({ task })));
    expect(sig(r)).toEqual(warns ? ["warn:V-01"] : []);
  });
});

describe("V-02 no salvage / resale credit (Req. 12)", () => {
  it("passes on a clean estimate (a positive scrap value is allowed)", () => expect(run(v02NoSalvage)).toEqual([]));

  it("blocks the salvage_resale category", () => {
    const r = run(v02NoSalvage, (c) => c.workstreams.abandonment.lineItems.push(line({ costCategory: "salvage_resale", unitRate: 500 })));
    expect(sig(r)).toEqual(["block:V-02"]);
  });

  it("blocks any negative amount", () => {
    const r = run(v02NoSalvage, (c) => c.workstreams.abandonment.lineItems.push(line({ unitRate: -250 })));
    expect(sig(r)).toEqual(["block:V-02"]);
  });

  it("warns on salvage / resale wording", () => {
    const r = run(v02NoSalvage, (c) => c.workstreams.abandonment.lineItems.push(line({ task: "Credit for resale of pumpjack" })));
    expect(sig(r)).toEqual(["warn:V-02"]);
  });
});

describe("V-03 scrap-metal credit needs support (Req. 12, 58(j))", () => {
  const scrap = (c: ValidationContext) => c.workstreams.abandonment.lineItems.find((l) => l.costCategory === "scrap_metal")!;

  it("passes with a document and a rate sheet", () => expect(run(v03ScrapSupport)).toEqual([]));

  it.each([
    ["no document", (l: ReturnType<typeof scrap>) => (l.supportingDocumentId = null), "Req. 12"],
    ["unknown document", (l: ReturnType<typeof scrap>) => (l.supportingDocumentId = "nope"), "Req. 12"],
    ["no rate sheet", (l: ReturnType<typeof scrap>) => (l.rateSheetId = null), "Req. 58(j)"],
    ["unknown rate sheet", (l: ReturnType<typeof scrap>) => (l.rateSheetId = "nope"), "Req. 58(j)"],
  ])("blocks: %s", (_n, mutate, req) => {
    const r = run(v03ScrapSupport, (c) => mutate(scrap(c)));
    expect(sig(r)).toEqual(["block:V-03"]);
    expect(r[0]!.req).toBe(req);
  });

  it("ignores a scrap line with no amount", () => {
    expect(
      run(v03ScrapSupport, (c) => {
        const l = scrap(c);
        l.supportingDocumentId = null;
        l.total = 0;
      }),
    ).toEqual([]);
  });
});

describe("V-04 every rate links to a rate sheet (Req. 3, 58(j))", () => {
  const add = (over: Parameters<typeof line>[0]) => (c: ValidationContext) => c.workstreams.suspension.lineItems.push(line(over));

  it("passes on a clean estimate", () => expect(run(v04RateSheetLink)).toEqual([]));

  it.each([
    ["no rate sheet", { rateSheetId: null }],
    ["unknown rate sheet", { rateSheetId: "ghost" }],
    ["no page reference", { rateSheetRef: "  " }],
  ] as const)("blocks: %s", (_n, over) => {
    expect(sig(run(v04RateSheetLink, add(over)))).toEqual(["block:V-04"]);
  });

  it.each([
    ["percent-based line", { calcMode: "percent_of_base", rateSheetId: null, rateSheetRef: null }],
    ["contingency line", { contingencyKind: "general", rateSheetId: null, rateSheetRef: null }],
    ["empty placeholder line", { task: "", quantity: null, unitRate: null, total: 0, rateSheetId: null, rateSheetRef: null }],
  ] as const)("does not require a rate sheet for a %s", (_n, over) => {
    expect(run(v04RateSheetLink, add(over))).toEqual([]);
  });
});

describe("V-05 client-specific / multi-site discounts (Req. 3)", () => {
  const withDiscount = (t: "client_specific" | "multi_site" | "available_to_all") => (c: ValidationContext) =>
    (c.rateSheets[0]!.discountType = t);

  it.each([["client_specific"], ["multi_site"]] as const)("blocks %s on every line that uses the sheet", (t) => {
    const r = run(v05ClientDiscount, withDiscount(t));
    const used = goodContext().workstreams;
    const n = Object.values(used).flatMap((w) => w.lineItems).filter((l) => l.rateSheetId === "rs1").length;
    expect(r).toHaveLength(n);
    expect(new Set(sig(r))).toEqual(new Set(["block:V-05"]));
  });

  it("allows a discount available to all parties", () => expect(run(v05ClientDiscount, withDiscount("available_to_all"))).toEqual([]));

  it("ignores a discounted sheet that no line uses", () => {
    const r = run(v05ClientDiscount, (c) => c.rateSheets.push({ id: "rs2", title: "Unused", effectiveDate: null, discountType: "client_specific" }));
    expect(r).toEqual([]);
  });
});

describe("V-06 rate sheet is current-day (Req. 3)", () => {
  const dated = (d: string | null) => (c: ValidationContext) => (c.rateSheets[0]!.effectiveDate = d);

  it.each([
    ["2026-06-01", false], // 5 months
    ["2025-11-06", false], // just under 12 months (now = 2026-11-05)
    ["2025-11-05", false], // exactly 12 months is not stale
    ["2025-11-04", true], // one day over
    ["2024-01-01", true],
    [null, true], // undated
  ])("effective %j -> warn=%j", (d, warns) => {
    const r = run(v06RateStaleness, dated(d));
    expect(new Set(sig(r))).toEqual(warns ? new Set(["warn:V-06"]) : new Set());
  });

  it("reports once per sheet per workstream, not once per line", () => {
    const r = run(v06RateStaleness, dated(null));
    const kinds = r.map((i) => i.workstream);
    expect(new Set(kinds).size).toBe(kinds.length);
  });
});
