import { describe, expect, it } from "vitest";
import { goodContext, line } from "./fixtures";
import { v08CareSecurityYears } from "./rules/v08-care-security-years";
import { v09PipelineMethod } from "./rules/v09-pipeline-method";
import { v15Req5Items } from "./rules/v15-req5-items";
import { v16Contingencies } from "./rules/v16-contingencies";
import { v20LandfillInfo } from "./rules/v20-landfill-info";
import { v21ReclamationElements } from "./rules/v21-reclamation-elements";
import { v24MaterialBalance } from "./rules/v24-material-balance";
import type { Issue, Rule, ValidationContext } from "./types";

const run = (rule: Rule, mutate?: (c: ValidationContext) => void): Issue[] => {
  const c = goodContext();
  mutate?.(c);
  return rule(c);
};
const sig = (issues: Issue[]) => issues.map((i) => `${i.severity}:${i.ruleId}`);

describe("V-08 at least 3 years of care and of security (Req. 8)", () => {
  const setCare = (quantity: number, unit: string) => (c: ValidationContext) => {
    const l = c.workstreams.care_security.lineItems.find((x) => x.costCategory === "care")!;
    l.quantity = quantity;
    l.unit = unit;
    l.total = 12000;
  };
  const setSecurity = (quantity: number, unit: string) => (c: ValidationContext) => {
    const l = c.workstreams.care_security.lineItems.find((x) => x.costCategory === "security")!;
    l.quantity = quantity;
    l.unit = unit;
  };

  it("passes with exactly 3 years of each", () => expect(run(v08CareSecurityYears)).toEqual([]));

  it.each([
    [3, "year", false],
    [2.99, "year", true],
    [36, "month", false],
    [35, "months", true],
    [156, "week", false],
    [155, "week", true],
    [1095, "day", false],
    [3, "ls", true], // unit that is not a duration counts as zero
  ])("care %j %s -> blocks=%j", (q, unit, blocks) => {
    const r = run(v08CareSecurityYears, setCare(q, unit));
    expect(sig(r)).toEqual(blocks ? ["block:V-08"] : []);
    if (blocks) expect(r[0]!.message).toMatch(/reasonable care/i);
  });

  it("checks security separately from care", () => {
    const r = run(v08CareSecurityYears, setSecurity(24, "month"));
    expect(sig(r)).toEqual(["block:V-08"]);
    expect(r[0]!.message).toMatch(/site security/i);
  });

  it("blocks both when neither is costed", () => {
    expect(sig(run(v08CareSecurityYears, (c) => (c.workstreams.care_security.lineItems = [])))).toEqual(["block:V-08", "block:V-08"]);
  });

  it("does not count a duration line with no cost", () => {
    expect(sig(run(v08CareSecurityYears, (c) => {
      c.workstreams.care_security.lineItems.find((x) => x.costCategory === "care")!.total = 0;
    }))).toEqual(["block:V-08"]);
  });

  it("cannot be marked not applicable", () => {
    const r = run(v08CareSecurityYears, (c) => (c.workstreams.care_security.applicable = false));
    expect(r.some((i) => /not applicable/i.test(i.message))).toBe(true);
  });
});

describe("V-09 pipeline abandoned in place or removed (Req. 11)", () => {
  it("passes for a well with no segments", () => expect(run(v09PipelineMethod)).toEqual([]));

  it("blocks a pipeline site with no segments", () => {
    expect(sig(run(v09PipelineMethod, (c) => (c.site.siteType = "pipeline")))).toEqual(["block:V-09"]);
  });

  it("blocks a segment with no method", () => {
    const r = run(v09PipelineMethod, (c) => {
      c.site.siteType = "pipeline";
      c.details.abandonment.pipelineSegments = [
        { id: "s1", label: "Seg 1", method: "removed" },
        { id: "s2", label: "Seg 2", method: null },
      ];
    });
    expect(sig(r)).toEqual(["block:V-09"]);
    expect(r[0]!.field).toBe("pipelineSegments.1.method");
  });

  it("accepts both methods on a pipeline", () => {
    expect(
      run(v09PipelineMethod, (c) => {
        c.site.siteType = "pipeline";
        c.details.abandonment.pipelineSegments = [
          { id: "s1", label: null, method: "in_place" },
          { id: "s2", label: null, method: "removed" },
        ];
      }),
    ).toEqual([]);
  });

  it("also checks pipe segments recorded on a non-pipeline site", () => {
    const r = run(v09PipelineMethod, (c) => (c.details.abandonment.pipelineSegments = [{ id: "s1", label: "Flowline", method: null }]));
    expect(sig(r)).toEqual(["block:V-09"]);
  });
});

describe("V-15 management and admin items (Req. 5)", () => {
  it("passes when (a)-(j) are costed and (k) is the general contingency", () => expect(run(v15Req5Items)).toEqual([]));

  it("blocks each missing item and cites its letter", () => {
    const r = run(v15Req5Items, (c) => {
      c.workstreams.mgmt_admin.lineItems = c.workstreams.mgmt_admin.lineItems.filter((l) => l.req5Item !== "c" && l.req5Item !== "g");
    });
    expect(r.map((i) => i.req)).toEqual(["Req. 5(c)", "Req. 5(g)"]);
  });

  it("accepts a written reason for a zero item", () => {
    expect(
      run(v15Req5Items, (c) => {
        c.workstreams.mgmt_admin.lineItems = c.workstreams.mgmt_admin.lineItems.filter((l) => l.req5Item !== "h");
        c.details.mgmt_admin.req5ZeroRationale = { h: "Safety supplies supplied by the licensee at no charge" };
      }),
    ).toEqual([]);
  });

  it("rejects a too-short reason", () => {
    const r = run(v15Req5Items, (c) => {
      c.workstreams.mgmt_admin.lineItems = c.workstreams.mgmt_admin.lineItems.filter((l) => l.req5Item !== "h");
      c.details.mgmt_admin.req5ZeroRationale = { h: "n/a" };
    });
    expect(sig(r)).toEqual(["block:V-15"]);
  });

  it("(k) needs a costed general contingency", () => {
    const r = run(v15Req5Items, (c) => (c.workstreams.contingencies.lineItems = []));
    expect(r.map((i) => i.req)).toEqual(["Req. 5(k)"]);
  });

  it("a line tagged with an item but costing nothing does not count", () => {
    const r = run(v15Req5Items, (c) => {
      c.workstreams.mgmt_admin.lineItems.find((l) => l.req5Item === "a")!.total = 0;
    });
    expect(r.map((i) => i.req)).toEqual(["Req. 5(a)"]);
  });
});

describe("V-16 contingencies are separate and substantiated (Req. 5(k), 20, 26, 34(a), 49)", () => {
  const contingency = (kind: "missing_history" | "unevaluated" | "restricted_access", rationale: string | null = "Two years of records are unavailable.") =>
    line({ costCategory: "contingency", contingencyKind: kind, rationale, rateSheetId: null, rateSheetRef: null, unitRate: 20000 });

  it("passes with only the general contingency", () => expect(run(v16Contingencies)).toEqual([]));

  it("blocks a contingency with a short rationale", () => {
    const r = run(v16Contingencies, (c) => (c.workstreams.contingencies.lineItems[0]!.rationale = "because"));
    expect(sig(r)).toEqual(["block:V-16"]);
  });

  it.each([
    ["missing history", "missingHistoryDeclared", "missing_history"],
    ["unevaluated issues", "unevaluatedIssuesDeclared", "unevaluated"],
  ] as const)("declared %s needs its own contingency line", (_n, flag, kind) => {
    const declared = (c: ValidationContext) => {
      c.details.contingencies[flag] = true;
      c.details.contingencies.missingHistorySearchMethods = "File search and interviews";
    };
    expect(sig(run(v16Contingencies, declared))).toEqual(["block:V-16"]);
    expect(
      run(v16Contingencies, (c) => {
        declared(c);
        c.workstreams.contingencies.lineItems.push(contingency(kind));
      }),
    ).toEqual([]);
  });

  it("missing history also needs the search methods described (Req. 49)", () => {
    const r = run(v16Contingencies, (c) => {
      c.details.contingencies.missingHistoryDeclared = true;
      c.workstreams.contingencies.lineItems.push(contingency("missing_history"));
    });
    expect(sig(r)).toEqual(["block:V-16"]);
    expect(r[0]!.req).toBe("Req. 49");
  });

  it("restricted access: needs a declaration rationale and a distinct contingency line (Req. 34(a))", () => {
    const declared = (c: ValidationContext) => (c.details.esa_remediation.restrictedAccess = { declared: true, rationale: "Live pipeline corridor" });
    expect(sig(run(v16Contingencies, declared))).toEqual(["block:V-16"]);
    expect(
      sig(run(v16Contingencies, (c) => {
        declared(c);
        c.details.esa_remediation.restrictedAccess.rationale = null;
        c.workstreams.contingencies.lineItems.push(contingency("restricted_access"));
      })),
    ).toEqual(["block:V-16"]);
    expect(
      run(v16Contingencies, (c) => {
        declared(c);
        c.workstreams.contingencies.lineItems.push(contingency("restricted_access"));
      }),
    ).toEqual([]);
  });

  it("warns on a costed contingency whose condition is not declared", () => {
    const r = run(v16Contingencies, (c) => c.workstreams.contingencies.lineItems.push(contingency("unevaluated")));
    expect(sig(r)).toEqual(["warn:V-16"]);
  });

  it("warns when the general contingency lumps in the other kinds", () => {
    const r = run(v16Contingencies, (c) => (c.workstreams.contingencies.lineItems[0]!.rationale = "Covers restricted access to the tank battery area"));
    expect(sig(r)).toEqual(["warn:V-16"]);
  });
});

describe("V-20 landfill note (Req. 14, 15)", () => {
  it("is silent for non-landfills", () => expect(run(v20LandfillInfo)).toEqual([]));
  it("informs for landfills", () => expect(sig(run(v20LandfillInfo, (c) => (c.site.isLandfill = true)))).toEqual(["info:V-20"]));
});

describe("V-21 reclamation plan elements (Req. 47)", () => {
  it("passes when (a)-(j) are addressed", () => expect(run(v21ReclamationElements)).toEqual([]));

  it("warns once, listing what is missing", () => {
    const r = run(v21ReclamationElements, (c) => (c.details.reclamation.elementsAddressed = ["a", "b", "c", "d", "f", "g", "h", "i", "j"]));
    expect(sig(r)).toEqual(["warn:V-21"]);
    expect(r[0]!.message).toContain("(e)");
    expect(r[0]!.message).not.toContain("(a)");
  });

  it("does not apply to landfills", () => {
    expect(run(v21ReclamationElements, (c) => {
      c.site.isLandfill = true;
      c.details.reclamation.elementsAddressed = [];
    })).toEqual([]);
  });
});

describe("V-24 demolition vs disposal material balance (Form 001-A note)", () => {
  const setDisposal = (t: number) => (c: ValidationContext) => {
    const l = c.workstreams.abandonment.lineItems.find((x) => x.formRowKey === "001-A:class_ii_landfill__disposal_fee")!;
    l.quantity = t;
    l.total = t * 80;
  };

  it("passes when demolition (20 t) equals disposal (15 t) plus scrap (5 t)", () => expect(run(v24MaterialBalance)).toEqual([]));

  it.each([
    [14, false], // 19 vs 20 = 5% off
    [13, false], // 18 vs 20 = 10% off: at the tolerance
    [12, true], // 17 vs 20 = 15% off
    [40, true],
  ])("disposal %j t -> warns=%j", (t, warns) => {
    expect(sig(run(v24MaterialBalance, setDisposal(t)))).toEqual(warns ? ["warn:V-24"] : []);
  });

  it("is silent when no tonnage is entered at all", () => {
    expect(run(v24MaterialBalance, (c) => (c.workstreams.abandonment.lineItems = []))).toEqual([]);
  });
});
