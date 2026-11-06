import { describe, expect, it } from "vitest";
import { goodContext, line } from "./fixtures";
import { v07BulkingFactor } from "./rules/v07-bulking-factor";
import { v10Phase1Id } from "./rules/v10-phase1-id";
import { v11Tier2Id } from "./rules/v11-tier2-id";
import { v12ApecPhase2 } from "./rules/v12-apec-phase2";
import { v13RoscId } from "./rules/v13-rosc-id";
import { v14BackfillSeparate } from "./rules/v14-backfill-separate";
import { v17VolumeBasis } from "./rules/v17-volume-basis";
import { v18DensityMoisture } from "./rules/v18-density-moisture";
import { v19TreatmentDetail } from "./rules/v19-treatment-detail";
import { RULES } from "./rules";
import type { Issue, Rule, ValidationContext } from "./types";

const run = (rule: Rule, mutate?: (c: ValidationContext) => void): Issue[] => {
  const c = goodContext();
  mutate?.(c);
  return rule(c);
};
const sig = (issues: Issue[]) => issues.map((i) => `${i.severity}:${i.ruleId}`);
const esa = (c: ValidationContext) => c.details.esa_remediation;

describe("V-07 bulking factor 1.2-1.4 (Req. 29)", () => {
  it("passes at 1.3", () => expect(run(v07BulkingFactor)).toEqual([]));

  it.each([
    [1.19, "block"],
    [1.2, null],
    [1.3, null],
    [1.4, null],
    [1.41, "block"],
    [2, "block"],
  ] as const)("factor %j without justification -> %j", (f, sev) => {
    const r = run(v07BulkingFactor, (c) => (esa(c).volumes.bulkingFactor = f));
    expect(sig(r)).toEqual(sev ? [`${sev}:V-07`] : []);
  });

  it("accepts a deviation once it is justified (info only)", () => {
    const r = run(v07BulkingFactor, (c) => {
      esa(c).volumes.bulkingFactor = 1.5;
      esa(c).volumes.bulkingJustification = "Fractured shale excavated in blocks; measured 1.5 on the pilot pit";
    });
    expect(sig(r)).toEqual(["info:V-07"]);
  });

  it("requires a factor when excavation is planned", () => {
    expect(sig(run(v07BulkingFactor, (c) => (esa(c).volumes.bulkingFactor = null)))).toEqual(["block:V-07"]);
  });

  it("warns when the basis is missing", () => {
    expect(sig(run(v07BulkingFactor, (c) => (esa(c).volumes.bulkingBasis = "")))).toEqual(["warn:V-07"]);
  });

  it("does not apply without an in-situ excavation volume", () => {
    expect(run(v07BulkingFactor, (c) => {
      esa(c).volumes.affectedInSituM3 = null;
      esa(c).volumes.bulkingFactor = null;
    })).toEqual([]);
  });
});

describe("V-10 Phase 1 ESA OneStop ID for remediation (Req. 17, 19, 58(d))", () => {
  it("passes with an ID", () => expect(run(v10Phase1Id)).toEqual([]));

  it("blocks remediation without an ID", () => {
    const r = run(v10Phase1Id, (c) => (esa(c).phase1OnestopId = null));
    expect(sig(r)).toEqual(["block:V-10"]);
    expect(r[0]!.req).toBe("Req. 17, 19, 58(d)");
  });

  it("blocks a whitespace-only ID", () => {
    expect(sig(run(v10Phase1Id, (c) => (esa(c).phase1OnestopId = "   ")))).toEqual(["block:V-10"]);
  });

  it("is not triggered when only ESA lines are costed", () => {
    expect(run(v10Phase1Id, (c) => {
      esa(c).phase1OnestopId = null;
      c.workstreams.esa_remediation.lineItems = c.workstreams.esa_remediation.lineItems.filter((l) => l.costCategory === "esa");
    })).toEqual([]);
  });
});

describe("V-11 Tier 2 needs a OneStop submission ID (Req. 37)", () => {
  it("passes for Tier 1", () => expect(run(v11Tier2Id)).toEqual([]));
  it("blocks Tier 2 without an ID", () => {
    expect(sig(run(v11Tier2Id, (c) => (esa(c).remediationApproach = "tier2")))).toEqual(["block:V-11"]);
  });
  it("passes Tier 2 with an ID", () => {
    expect(run(v11Tier2Id, (c) => {
      esa(c).remediationApproach = "tier2";
      esa(c).tier2OnestopId = "T2-0042";
    })).toEqual([]);
  });
});

describe("V-12 APECs need a Phase 2 ESA (Req. 21, 34)", () => {
  it("passes with a Phase 2 ID", () => expect(run(v12ApecPhase2)).toEqual([]));
  it("blocks APECs without Phase 2", () => {
    expect(sig(run(v12ApecPhase2, (c) => (esa(c).phase2OnestopId = null)))).toEqual(["block:V-12"]);
  });
  it("passes when there are no APECs", () => {
    expect(run(v12ApecPhase2, (c) => {
      esa(c).phase2OnestopId = null;
      esa(c).apecs = [];
    })).toEqual([]);
  });
  it("downgrades to a warning for declared restricted access with a restricted-access contingency", () => {
    const r = run(v12ApecPhase2, (c) => {
      esa(c).phase2OnestopId = null;
      esa(c).restrictedAccess = { declared: true, rationale: "Active pipeline corridor" };
      c.workstreams.contingencies.lineItems.push(line({ contingencyKind: "restricted_access", rationale: "Unassessed area", unitRate: 5000 }));
    });
    expect(sig(r)).toEqual(["warn:V-12"]);
  });
  it("still blocks when restricted access is declared but not costed", () => {
    expect(sig(run(v12ApecPhase2, (c) => {
      esa(c).phase2OnestopId = null;
      esa(c).restrictedAccess = { declared: true, rationale: "Active pipeline corridor" };
    }))).toEqual(["block:V-12"]);
  });
});

describe("V-13 Record of Site Condition ID (Req. 17, 58(d))", () => {
  it("passes with an ID", () => expect(run(v13RoscId)).toEqual([]));
  it("only warns when missing", () => {
    expect(sig(run(v13RoscId, (c) => (esa(c).roscOnestopId = null)))).toEqual(["warn:V-13"]);
  });
});

describe("V-14 backfill import separate from overburden/topsoil handling (Req. 43(c), 44)", () => {
  it("passes on the good estimate", () => expect(run(v14BackfillSeparate)).toEqual([]));

  it("blocks off-site disposal with no backfill-import cost", () => {
    const r = run(v14BackfillSeparate, (c) => {
      c.workstreams.esa_remediation.lineItems = c.workstreams.esa_remediation.lineItems.filter((l) => l.costCategory !== "backfill_import");
    });
    expect(sig(r)).toEqual(["block:V-14"]);
    expect(r[0]!.req).toBe("Req. 43(c), 44");
  });

  it("does not require backfill when nothing goes off site", () => {
    expect(run(v14BackfillSeparate, (c) => {
      esa(c).offSiteDisposalPlanned = false;
      c.workstreams.esa_remediation.lineItems = c.workstreams.esa_remediation.lineItems.filter(
        (l) => l.costCategory !== "backfill_import" && l.costCategory !== "remediation_off_site",
      );
    })).toEqual([]);
  });

  it("blocks overburden handling entered on a backfill row", () => {
    const r = run(v14BackfillSeparate, (c) => {
      c.workstreams.esa_remediation.lineItems.find((l) => l.costCategory === "overburden_topsoil_handling")!.formRowKey = "001-B:purchase_and_delivery";
    });
    expect(sig(r)).toEqual(["block:V-14"]);
  });

  it("blocks backfill import entered on the topsoil row", () => {
    const r = run(v14BackfillSeparate, (c) => {
      c.workstreams.esa_remediation.lineItems.find((l) => l.costCategory === "backfill_import")!.formRowKey = "001-B:topsoil_purchase_delivery_and_placement";
    });
    expect(sig(r)).toEqual(["block:V-14"]);
  });

  it("warns when one line mentions both", () => {
    const r = run(v14BackfillSeparate, (c) => {
      c.workstreams.esa_remediation.lineItems.find((l) => l.costCategory === "overburden_topsoil_handling")!.task = "Backfill and topsoil placement";
    });
    expect(sig(r)).toEqual(["warn:V-14"]);
  });
});

describe("V-17 volume basis and site drawing (Req. 28, 31)", () => {
  it("passes on the good estimate", () => expect(run(v17VolumeBasis)).toEqual([]));

  it.each([
    ["plume factor", (c: ValidationContext) => (esa(c).volumes.plumeIrregularityFactor = null), "Req. 28"],
    ["plume basis", (c: ValidationContext) => (esa(c).volumes.plumeBasis = " "), "Req. 28"],
    ["site drawing", (c: ValidationContext) => (c.documents = c.documents.filter((d) => d.kind !== "site_drawing")), "Req. 31"],
  ])("blocks a missing %s", (_n, mutate, req) => {
    const r = run(v17VolumeBasis, mutate);
    expect(sig(r)).toEqual(["block:V-17"]);
    expect(r[0]!.req).toBe(req);
  });

  it("does not apply without an excavation volume", () => {
    expect(run(v17VolumeBasis, (c) => {
      esa(c).volumes.affectedInSituM3 = null;
      esa(c).volumes.plumeIrregularityFactor = null;
      c.documents = [];
    })).toEqual([]);
  });
});

describe("V-18 density and moisture for off-site disposal (Req. 32, 33)", () => {
  it("passes on the good estimate", () => expect(run(v18DensityMoisture)).toEqual([]));

  it("blocks each missing item", () => {
    const r = run(v18DensityMoisture, (c) => {
      esa(c).volumes.soilDensityTPerM3 = null;
      esa(c).volumes.moisturePct = null;
      esa(c).volumes.densityMethod = null;
    });
    expect(r.map((i) => i.req)).toEqual(["Req. 32", "Req. 32", "Req. 33"]);
  });

  it("is not needed when everything is treated on site", () => {
    expect(run(v18DensityMoisture, (c) => {
      esa(c).offSiteDisposalPlanned = false;
      esa(c).volumes.soilDensityTPerM3 = null;
      c.workstreams.esa_remediation.lineItems = c.workstreams.esa_remediation.lineItems.filter((l) => l.costCategory !== "remediation_off_site");
    })).toEqual([]);
  });
});

describe("V-19 treatment detail (Req. 24, 39(b), 40, 41, 42, 45)", () => {
  it("passes on the good estimate", () => expect(run(v19TreatmentDetail)).toEqual([]));

  it("requires the on-site / off-site split to be stated", () => {
    const r = run(v19TreatmentDetail, (c) => (esa(c).offSiteDisposalPlanned = false));
    expect(sig(r)).toEqual(["block:V-19"]);
    expect(r[0]!.req).toBe("Req. 39(b)");
  });

  it("on-site treatment needs approach, suitability, treatability, volume and duration rationale", () => {
    const r = run(v19TreatmentDetail, (c) => (esa(c).onSiteTreatment.planned = true));
    expect(r.map((i) => i.req)).toEqual(["Req. 41(a)", "Req. 41(b)", "Req. 41(c)", "Req. 41(d)", "Req. 41(d)"]);
  });

  it("groundwater remediation needs source removal, approach, duration basis and volume", () => {
    const r = run(v19TreatmentDetail, (c) => (esa(c).groundwater.planned = true));
    expect(r.map((i) => i.req)).toEqual(["Req. 42(a)", "Req. 42(b)", "Req. 42(c)", "Req. 42(d)"]);
  });

  it("on-site system needs type, dimensions, duration and the O&M and abandonment confirmations", () => {
    const r = run(v19TreatmentDetail, (c) => (esa(c).onSiteSystem.planned = true));
    expect(r.map((i) => i.req)).toEqual(["Req. 45(a)", "Req. 45(b)", "Req. 45(d)", "Req. 45(e)-(f)", "Req. 45(g)"]);
  });

  it("warns when lower aquifer assessment is missing", () => {
    const r = run(v19TreatmentDetail, (c) => (esa(c).groundwater.contaminationApparent = true));
    expect(sig(r)).toEqual(["warn:V-19"]);
    expect(r[0]!.req).toBe("Req. 24");
  });

  it("in-place remediation needs a duration and a real supporting document", () => {
    const r = run(v19TreatmentDetail, (c) => {
      esa(c).inPlaceRemediation = { planned: true, durationYears: null, supportingDocumentId: "missing" };
    });
    expect(r.map((i) => i.req)).toEqual(["Req. 40", "Req. 40"]);
    expect(
      run(v19TreatmentDetail, (c) => {
        c.documents.push({ id: "d-inplace", kind: "supporting", title: "In-place remediation study" });
        esa(c).inPlaceRemediation = { planned: true, durationYears: 8, supportingDocumentId: "d-inplace" };
      }),
    ).toEqual([]);
  });
});

describe("landfills skip section 5 rules (Req. 15)", () => {
  const section5 = ["V-07", "V-10", "V-11", "V-12", "V-13", "V-14", "V-17", "V-18", "V-19", "V-21"];
  it.each(section5)("%s returns nothing for a landfill, even with bad data", (id) => {
    const c = goodContext();
    c.site.isLandfill = true;
    esa(c).phase1OnestopId = null;
    esa(c).remediationApproach = "tier2";
    esa(c).phase2OnestopId = null;
    esa(c).volumes.bulkingFactor = 9;
    esa(c).volumes.plumeIrregularityFactor = null;
    esa(c).offSiteDisposalPlanned = false;
    esa(c).onSiteTreatment.planned = true;
    c.details.reclamation.elementsAddressed = [];
    c.documents = [];
    c.workstreams.esa_remediation.lineItems = c.workstreams.esa_remediation.lineItems.filter((l) => l.costCategory !== "backfill_import");
    expect(RULES[id]!(c)).toEqual([]);
  });
});
