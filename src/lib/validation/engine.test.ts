import { describe, expect, it } from "vitest";
import { blockers, canSubmit, countsByWorkstream, issuesFor, validate } from "./engine";
import { goodContext, line } from "./fixtures";
import { RULES } from "./rules";
import type { ValidationContext } from "./types";

describe("known-good estimate", () => {
  it("produces no issues of any severity", () => {
    expect(validate(goodContext())).toEqual([]);
  });

  it("registers every Phase 1 rule", () => {
    expect(Object.keys(RULES).sort()).toEqual(
      ["V-01", "V-02", "V-03", "V-04", "V-05", "V-06", "V-07", "V-08", "V-09", "V-10", "V-11", "V-12", "V-13", "V-14", "V-15", "V-16", "V-17", "V-18", "V-19", "V-20", "V-21", "V-24"],
    );
  });
});

/**
 * Mutation matrix: one deliberate fault per case. Each must trigger its own rule at the stated
 * severity, and no other blocking rule (keeps rules from overlapping or double-reporting).
 */
const mutations: [string, string, "block" | "warn" | "info", (c: ValidationContext) => void][] = [
  ["V-01", "block", "block", (c) => (c.details.mgmt_admin.attestations.noNpvDiscount = false)],
  ["V-02", "negative amount", "block", (c) => {
    const l = c.workstreams.suspension.lineItems[0]!;
    l.unitRate = -5000;
    l.total = -5000; // the database derives total; fixtures mutate both
  }],
  ["V-03", "scrap without document", "block", (c) => (c.workstreams.abandonment.lineItems[2]!.supportingDocumentId = null)],
  ["V-04", "unlinked rate", "block", (c) => (c.workstreams.suspension.lineItems[0]!.rateSheetId = null)],
  ["V-05", "client discount", "block", (c) => (c.rateSheets[0]!.discountType = "client_specific")],
  ["V-06", "stale rate sheet", "warn", (c) => (c.rateSheets[0]!.effectiveDate = "2024-01-01")],
  ["V-07", "bulking 1.5", "block", (c) => (c.details.esa_remediation.volumes.bulkingFactor = 1.5)],
  ["V-08", "2 years of care", "block", (c) => (c.workstreams.care_security.lineItems[0]!.quantity = 2)],
  ["V-09", "segment without method", "block", (c) => {
    c.site.siteType = "pipeline";
    c.details.abandonment.pipelineSegments = [{ id: "s1", label: "Seg 1", method: null }];
  }],
  ["V-10", "no Phase 1 ID", "block", (c) => (c.details.esa_remediation.phase1OnestopId = null)],
  ["V-11", "Tier 2 without ID", "block", (c) => (c.details.esa_remediation.remediationApproach = "tier2")],
  ["V-12", "APEC without Phase 2", "block", (c) => (c.details.esa_remediation.phase2OnestopId = null)],
  ["V-13", "no RoSC ID", "warn", (c) => (c.details.esa_remediation.roscOnestopId = null)],
  ["V-14", "no backfill", "block", (c) => {
    c.workstreams.esa_remediation.lineItems = c.workstreams.esa_remediation.lineItems.filter((l) => l.costCategory !== "backfill_import");
  }],
  ["V-15", "missing item (c)", "block", (c) => {
    c.workstreams.mgmt_admin.lineItems = c.workstreams.mgmt_admin.lineItems.filter((l) => l.req5Item !== "c");
  }],
  ["V-16", "short rationale", "block", (c) => (c.workstreams.contingencies.lineItems[0]!.rationale = "short")],
  ["V-17", "no site drawing", "block", (c) => (c.documents = c.documents.filter((d) => d.kind !== "site_drawing"))],
  ["V-18", "no density", "block", (c) => (c.details.esa_remediation.volumes.soilDensityTPerM3 = null)],
  ["V-19", "split not stated", "block", (c) => (c.details.esa_remediation.offSiteDisposalPlanned = false)],
  ["V-21", "reclamation element missing", "warn", (c) => (c.details.reclamation.elementsAddressed = ["a"])],
  ["V-24", "material imbalance", "warn", (c) => (c.workstreams.abandonment.lineItems[0]!.quantity = 60)],
];

describe("mutation matrix", () => {
  it.each(mutations)("%s: %s", (ruleId, _name, severity, mutate) => {
    const c = goodContext();
    mutate(c);
    const issues = validate(c);
    expect(issues.some((i) => i.ruleId === ruleId && i.severity === severity)).toBe(true);
    const otherBlocks = blockers(issues).filter((i) => i.ruleId !== ruleId);
    expect(otherBlocks.map((i) => i.ruleId)).toEqual([]);
  });
});

describe("engine behaviour", () => {
  it("sorts blockers before warnings before info", () => {
    const c = goodContext();
    c.details.esa_remediation.roscOnestopId = null; // warn
    c.details.esa_remediation.phase1OnestopId = null; // block
    c.site.isLandfill = false;
    const sev = validate(c).map((i) => i.severity);
    expect(sev).toEqual([...sev].sort((a, b) => ({ block: 0, warn: 1, info: 2 })[a] - ({ block: 0, warn: 1, info: 2 })[b]));
    expect(sev[0]).toBe("block");
  });

  it("drops issues on a workstream marked not applicable", () => {
    const c = goodContext();
    c.workstreams.reclamation.applicable = false;
    c.details.reclamation.elementsAddressed = [];
    expect(validate(c)).toEqual([]);
  });

  it("keeps V-08 even if care and security is marked not applicable", () => {
    const c = goodContext();
    c.workstreams.care_security.applicable = false;
    expect(validate(c).some((i) => i.ruleId === "V-08")).toBe(true);
  });

  it("canSubmit is per workstream", () => {
    const c = goodContext();
    c.details.esa_remediation.phase1OnestopId = null;
    const issues = validate(c);
    expect(canSubmit(issues, "esa_remediation")).toBe(false);
    expect(canSubmit(issues, "abandonment")).toBe(true);
    expect(issuesFor(issues, "esa_remediation").length).toBeGreaterThan(0);
  });

  it("warnings and info never block submission", () => {
    const c = goodContext();
    c.details.esa_remediation.roscOnestopId = null;
    c.site.isLandfill = true; // adds a V-20 info
    expect(canSubmit(validate(c), "esa_remediation")).toBe(true);
  });

  it("an unfilled placeholder row is ignored by all rules", () => {
    const c = goodContext();
    c.workstreams.suspension.lineItems.push(line({ task: "", quantity: null, unitRate: null, total: 0, rateSheetId: null, rateSheetRef: null }));
    expect(validate(c)).toEqual([]);
  });

  it("countsByWorkstream totals by severity", () => {
    const c = goodContext();
    c.details.esa_remediation.roscOnestopId = null;
    c.details.esa_remediation.phase1OnestopId = null;
    const counts = countsByWorkstream(validate(c));
    expect(counts.esa_remediation).toEqual({ block: 1, warn: 1, info: 0 });
    expect(counts.abandonment).toEqual({ block: 0, warn: 0, info: 0 });
  });
});
