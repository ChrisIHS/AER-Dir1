import { describe, expect, it } from "vitest";
import type { TrackerItem } from "@/lib/tracker/tracker";
import { checkPackage } from "./precheck";

const item = (ref: string, status: TrackerItem["status"]): TrackerItem => ({
  ref, title: `Item ${ref}`, req: `Req. 58(${ref})`, status, owner: "Someone", detail: `detail ${ref}`,
});
const allGreen = ["a", "b", "c", "d", "e", "f", "g.i", "g.ii", "g.iii", "h", "i", "j", "k"].map((r) => item(r, "green"));

describe("checkPackage (V-25 and gate)", () => {
  it("passes when all required items are green", () => {
    expect(checkPackage({ tracker: allGreen, issues: [], documents: [] })).toEqual([]);
  });

  it("passes with n/a items", () => {
    const t = allGreen.map((i) => (i.ref === "b" ? { ...i, status: "na" as const } : i));
    expect(checkPackage({ tracker: t, issues: [], documents: [] })).toEqual([]);
  });

  it("does not wait on items completed around the package (g.i, g.ii, i, k)", () => {
    const t = allGreen.map((i) => (["g.i", "g.ii", "i", "k"].includes(i.ref) ? { ...i, status: "red" as const } : i));
    expect(checkPackage({ tracker: t, issues: [], documents: [] })).toEqual([]);
  });

  it.each(["a", "c", "d", "e", "f", "g.iii", "h", "j"])("blocks when item %s is not complete", (ref) => {
    for (const status of ["red", "amber"] as const) {
      const t = allGreen.map((i) => (i.ref === ref ? { ...i, status } : i));
      const p = checkPackage({ tracker: t, issues: [], documents: [] });
      expect(p).toHaveLength(1);
      expect(p[0]!.message).toContain(`detail ${ref}`);
    }
  });

  it.each(["remedial_action_plan", "contamination_mgmt_report"] as const)("V-25 refuses a %s document (Req. 17)", (kind) => {
    const p = checkPackage({ tracker: allGreen, issues: [], documents: [{ kind, title: "RAP v2.pdf" }] });
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ ruleId: "V-25", req: "Req. 17" });
    expect(p[0]!.message).toContain("RAP v2.pdf");
  });

  it("other document kinds are fine", () => {
    expect(checkPackage({ tracker: allGreen, issues: [], documents: [{ kind: "phase1_esa", title: "P1" }, { kind: "supporting", title: "S" }] })).toEqual([]);
  });

  it("blocking issues block, warnings do not", () => {
    const warn = { ruleId: "V-13", severity: "warn", req: "Req. 17", message: "w", workstream: "esa_remediation" } as const;
    const block = { ...warn, ruleId: "V-10", severity: "block" } as const;
    expect(checkPackage({ tracker: allGreen, issues: [warn], documents: [] })).toEqual([]);
    expect(checkPackage({ tracker: allGreen, issues: [block, block], documents: [] })[0]!.message).toBe("2 blocking validation issues remain.");
  });
});
