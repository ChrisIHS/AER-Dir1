import { describe, expect, it } from "vitest";
import { validate } from "@/lib/validation/engine";
import { goodContext } from "@/lib/validation/fixtures";
import { WORKSTREAM_KINDS, type DocumentKind, type ValidationContext } from "@/lib/validation/types";
import { computeTracker, overallStatus, type TrackerInput, type WorkstreamStatus } from "./tracker";

const PLAN_DOCS: DocumentKind[] = ["suspension_plan", "abandonment_plan", "remediation_plan", "reclamation_plan", "supporting"];

function input(over: Partial<TrackerInput> = {}, mutate?: (c: ValidationContext) => void): TrackerInput {
  const ctx = goodContext();
  PLAN_DOCS.forEach((kind, i) => ctx.documents.push({ id: `plan-${i}`, kind, title: kind }));
  mutate?.(ctx);
  const status = Object.fromEntries(WORKSTREAM_KINDS.map((k) => [k, "approved"])) as Record<(typeof WORKSTREAM_KINDS)[number], WorkstreamStatus>;
  return {
    ctx,
    issues: validate(ctx),
    workstreamStatus: status,
    owners: {
      workstream: Object.fromEntries(WORKSTREAM_KINDS.map((k) => [k, `Owner of ${k}`])) as TrackerInput["owners"]["workstream"],
      licensee: "Licensee Admin",
      leadAssessor: "Lead Assessor",
    },
    manual: {
      liabilityDeclaration: "signed",
      costFormsGenerated: true,
      signoffs: { care_susp_aband: true, remediation_reclamation: true },
      supportingInfoNoneRequiredReason: null,
      aerSystemUpdate: { date: "2026-11-05", reference: "SSLA-TEST-1" },
    },
    ...over,
  };
}

const get = (items: ReturnType<typeof computeTracker>, ref: string) => items.find((i) => i.ref === ref)!;

describe("completeness tracker (Req. 58)", () => {
  it("lists every Req. 58 item (a-k, with g split in three)", () => {
    expect(computeTracker(input()).map((i) => i.ref)).toEqual(["a", "b", "c", "d", "e", "f", "g.i", "g.ii", "g.iii", "h", "i", "j", "k"]);
  });

  it("is all green (b is n/a for a well) when everything is complete and approved", () => {
    const items = computeTracker(input());
    expect(items.filter((i) => i.status !== "green").map((i) => `${i.ref}:${i.status}`)).toEqual(["b:na"]);
    expect(overallStatus(items).ready).toBe(true);
  });

  it("every item names an owner except n/a ones", () => {
    for (const i of computeTracker(input())) if (i.status !== "na") expect(i.owner).toBeTruthy();
  });

  describe("plan documents (a, c, e, f)", () => {
    it("red when the plan is not uploaded", () => {
      const items = computeTracker(input({}, (c) => (c.documents = c.documents.filter((d) => d.kind !== "suspension_plan"))));
      expect(get(items, "a").status).toBe("red");
    });
    it("amber when uploaded but the workstream is not approved", () => {
      const inp = input();
      inp.workstreamStatus.abandonment = "submitted";
      expect(get(computeTracker(inp), "c").status).toBe("amber");
    });
    it("red when the workstream has blocking issues, even with the plan uploaded", () => {
      const items = computeTracker(input({}, (c) => (c.details.abandonment.attestations.noNpvDiscount = false)));
      expect(get(items, "c").status).toBe("red");
    });
    it("remediation plan is n/a when no remediation is costed", () => {
      const items = computeTracker(input({}, (c) => {
        c.workstreams.esa_remediation.lineItems = c.workstreams.esa_remediation.lineItems.filter((l) => l.costCategory === "esa");
      }));
      expect(get(items, "e").status).toBe("na");
    });
    it("a not-applicable workstream makes its plan item n/a", () => {
      const items = computeTracker(input({}, (c) => (c.workstreams.reclamation.applicable = false)));
      expect(get(items, "f").status).toBe("na");
    });
  });

  describe("pipelines (b)", () => {
    it("requires a discontinuation plan", () => {
      const items = computeTracker(input({}, (c) => {
        c.site.siteType = "pipeline";
        c.details.abandonment.pipelineSegments = [{ id: "s", label: null, method: "removed" }];
      }));
      expect(get(items, "b").status).toBe("red");
    });
    it("goes green with the plan uploaded and the suspension workstream approved", () => {
      const items = computeTracker(input({}, (c) => {
        c.site.siteType = "pipeline";
        c.details.abandonment.pipelineSegments = [{ id: "s", label: null, method: "removed" }];
        c.documents.push({ id: "disc", kind: "discontinuation_plan", title: "Discontinuation" });
      }));
      expect(get(items, "b").status).toBe("green");
    });
  });

  describe("ESA OneStop IDs (d)", () => {
    it("red without a Phase 1 ID", () => {
      expect(get(computeTracker(input({}, (c) => (c.details.esa_remediation.phase1OnestopId = null))), "d").status).toBe("red");
    });
    it("red without a Phase 2 ID when APECs are listed", () => {
      expect(get(computeTracker(input({}, (c) => (c.details.esa_remediation.phase2OnestopId = null))), "d").status).toBe("red");
    });
    it("amber without an RoSC ID", () => {
      expect(get(computeTracker(input({}, (c) => (c.details.esa_remediation.roscOnestopId = null))), "d").status).toBe("amber");
    });
    it("n/a for a landfill (Req. 15)", () => {
      expect(get(computeTracker(input({}, (c) => (c.site.isLandfill = true))), "d").status).toBe("na");
    });
  });

  describe("forms and sign-off (g)", () => {
    it.each([
      ["none", "red"],
      ["generated", "amber"],
      ["signed", "green"],
    ] as const)("Liability Declaration %s -> %s", (state, rag) => {
      const inp = input();
      inp.manual.liabilityDeclaration = state;
      expect(get(computeTracker(inp), "g.i").status).toBe(rag);
    });

    it("cost forms are red until every applicable workstream is approved", () => {
      const inp = input();
      inp.workstreamStatus.mgmt_admin = "in_progress";
      const g = get(computeTracker(inp), "g.ii");
      expect(g.status).toBe("red");
      expect(g.detail).toContain("mgmt_admin");
    });

    it("cost forms are amber once approved but not yet generated", () => {
      const inp = input();
      inp.manual.costFormsGenerated = false;
      expect(get(computeTracker(inp), "g.ii").status).toBe("amber");
    });

    it.each([
      [{ care_susp_aband: false, remediation_reclamation: false }, "red"],
      [{ care_susp_aband: true, remediation_reclamation: false }, "amber"],
      [{ care_susp_aband: true, remediation_reclamation: true }, "green"],
    ] as const)("acknowledgement statements %j -> %s", (signoffs, rag) => {
      const inp = input();
      inp.manual.signoffs = { ...signoffs };
      expect(get(computeTracker(inp), "g.iii").status).toBe(rag);
    });

    it("both statements are required even when remediation and reclamation do not apply", () => {
      const inp = input({}, (c) => {
        c.workstreams.esa_remediation.applicable = false;
        c.workstreams.reclamation.applicable = false;
      });
      inp.manual.signoffs = { care_susp_aband: true, remediation_reclamation: false };
      const g = get(computeTracker(inp), "g.iii");
      expect(g.status).toBe("amber");
      expect(g.detail).toBe("Signed 1 of 2.");
    });

    it("owner of the acknowledgement statements is the lead assessor", () => {
      expect(get(computeTracker(input()), "g.iii").owner).toBe("Lead Assessor");
    });
  });

  describe("costs, support, rate sheets, AER update (h-k)", () => {
    it("h is red with any blocking issue", () => {
      expect(get(computeTracker(input({}, (c) => (c.details.esa_remediation.phase1OnestopId = null))), "h").status).toBe("red");
    });
    it("h is amber with no blockers but unapproved workstreams", () => {
      const inp = input();
      inp.workstreamStatus.suspension = "submitted";
      expect(get(computeTracker(inp), "h").status).toBe("amber");
    });
    it("i needs supporting documents or a recorded reason", () => {
      const noSupport = (c: ValidationContext) => (c.documents = c.documents.filter((d) => d.kind !== "supporting"));
      expect(get(computeTracker(input({}, noSupport)), "i").status).toBe("amber");
      const inp = input({}, noSupport);
      inp.manual.supportingInfoNoneRequiredReason = "No hazardous materials on this lease";
      expect(get(computeTracker(inp), "i").status).toBe("green");
    });
    it("j is red when a rate has no rate sheet", () => {
      const items = computeTracker(input({}, (c) => (c.workstreams.suspension.lineItems[0]!.rateSheetId = null)));
      expect(get(items, "j").status).toBe("red");
    });
    it("j is amber for an uploaded but unreferenced rate sheet", () => {
      const items = computeTracker(input({}, (c) => c.rateSheets.push({ id: "rs-extra", title: "Extra", effectiveDate: "2026-06-01", discountType: "none" })));
      expect(get(items, "j").status).toBe("amber");
    });
    it("j is amber when the rate sheet is stale", () => {
      const items = computeTracker(input({}, (c) => (c.rateSheets[0]!.effectiveDate = "2024-01-01")));
      expect(get(items, "j").status).toBe("amber");
    });
    it("k is red until the AER system update is recorded", () => {
      const inp = input();
      inp.manual.aerSystemUpdate = null;
      expect(get(computeTracker(inp), "k").status).toBe("red");
    });
  });

  it("overallStatus is not ready while anything is red or amber", () => {
    const inp = input();
    inp.manual.aerSystemUpdate = null;
    const o = overallStatus(computeTracker(inp));
    expect(o.red).toBe(1);
    expect(o.ready).toBe(false);
  });
});
