import { describe, expect, it } from "vitest";
import type { TrackerItem, WorkstreamStatus } from "@/lib/tracker/tracker";
import { WORKSTREAM_KINDS, type Issue, type WorkstreamKind } from "@/lib/validation/types";
import { portfolioCsv, portfolioTotals, stageOf, summarizeSite, workItems, type SiteSummaryInput } from "./portfolio";

const all = (status: WorkstreamStatus, assigned = true) =>
  Object.fromEntries(WORKSTREAM_KINDS.map((k) => [k, { applicable: true, status, assigned }])) as SiteSummaryInput["workstreams"];

const input = (over: Partial<SiteSummaryInput> = {}): SiteSummaryInput => ({
  siteId: "s1", name: "Demo Well", siteType: "well", licenceNumber: "DEMO-W-0001", isLandfill: false,
  workstreams: all("not_started"), issues: [], tracker: [], estimateCents: 1_000_00,
  signoffs: { care_susp_aband: false, remediation_reclamation: false }, officer: "none", packageCount: 0, ...over,
});
const issue = (workstream: WorkstreamKind, severity: Issue["severity"]): Issue => ({ ruleId: "V-04", severity, req: "Req. 3", message: "m", workstream });
const item = (ref: string, status: TrackerItem["status"]): TrackerItem => ({ ref, title: ref, req: "", status, owner: null, detail: "" });

describe("stageOf", () => {
  it.each([
    ["nothing started", all("not_started"), "setup"],
    ["some started", { ...all("not_started"), abandonment: { applicable: true, status: "in_progress", assigned: true } }, "in_progress"],
    ["one changes requested", { ...all("approved"), abandonment: { applicable: true, status: "changes_requested", assigned: true } }, "in_progress"],
    ["one submitted", { ...all("in_progress"), abandonment: { applicable: true, status: "submitted", assigned: true } }, "in_review"],
    ["all approved", all("approved"), "ready_for_signoff"],
  ] as const)("%s -> %s", (_n, workstreams, stage) => {
    expect(stageOf(input({ workstreams: workstreams as SiteSummaryInput["workstreams"] }))).toBe(stage);
  });

  it("ignores workstreams that do not apply", () => {
    const w = all("approved");
    w.reclamation = { applicable: false, status: "not_started", assigned: false };
    expect(stageOf(input({ workstreams: w }))).toBe("ready_for_signoff");
  });

  it("signed needs both statements; packaged needs a built package as well", () => {
    const one = { care_susp_aband: true, remediation_reclamation: false };
    const both = { care_susp_aband: true, remediation_reclamation: true };
    expect(stageOf(input({ workstreams: all("approved"), signoffs: one }))).toBe("ready_for_signoff");
    expect(stageOf(input({ workstreams: all("approved"), signoffs: both }))).toBe("signed");
    expect(stageOf(input({ workstreams: all("approved"), signoffs: both, packageCount: 2 }))).toBe("packaged");
    expect(stageOf(input({ workstreams: all("approved"), packageCount: 2 }))).toBe("ready_for_signoff");
  });
});

describe("summarizeSite", () => {
  it("counts approvals, issues and tracker states", () => {
    const w = all("approved");
    w.suspension.status = "in_progress";
    const s = summarizeSite(input({
      workstreams: w,
      issues: [issue("abandonment", "block"), issue("abandonment", "warn"), issue("suspension", "warn")],
      tracker: [item("a", "green"), item("b", "na"), item("c", "red"), item("d", "amber")],
    }));
    expect(s).toMatchObject({ approved: 6, applicable: 7, blocking: 1, warnings: 2, stage: "in_progress", estimateCents: 100000 });
    expect(s.tracker).toEqual({ red: 1, amber: 1, green: 1, na: 1 });
  });

  it.each([
    ["setup, unassigned", { workstreams: all("not_started", false) }, "Assign workstreams to contractors"],
    ["setup, assigned", { workstreams: all("not_started", true) }, "Waiting for contractors to start"],
    ["blocking issues", { workstreams: { ...all("in_progress") }, issues: [issue("suspension", "block"), issue("suspension", "block")] }, "Fix 2 blocking issues"],
    ["returned", { workstreams: { ...all("in_progress"), suspension: { applicable: true, status: "changes_requested", assigned: true } } }, "1 workstream returned for changes"],
    ["in review", { workstreams: { ...all("approved"), suspension: { applicable: true, status: "submitted", assigned: true } } }, "Review 1 submitted workstream"],
    ["ready", { workstreams: all("approved") }, "Lead assessor to sign off"],
  ] as const)("next action when %s", (_n, over, text) => {
    expect(summarizeSite(input(over as Partial<SiteSummaryInput>)).nextAction).toBe(text);
  });

  it("after sign-off the next step follows the officer's e-signature state", () => {
    const base = { workstreams: all("approved"), signoffs: { care_susp_aband: true, remediation_reclamation: true } };
    expect(summarizeSite(input({ ...base, officer: "none" })).nextAction).toMatch(/Senior officer to sign F035/);
    expect(summarizeSite(input({ ...base, officer: "stale" })).nextAction).toMatch(/Estimate changed/);
    expect(summarizeSite(input({ ...base, officer: "valid" })).nextAction).toBe("Build the submission package");
  });

  it("a built package leaves only the AER steps", () => {
    const base = { workstreams: all("approved"), signoffs: { care_susp_aband: true, remediation_reclamation: true }, packageCount: 1 };
    expect(summarizeSite(input({ ...base, tracker: [item("k", "red")] })).nextAction).toMatch(/ssla@aer.ca/);
    expect(summarizeSite(input({ ...base, tracker: [item("k", "green")] })).nextAction).toBe("Complete");
  });
});

describe("portfolioTotals", () => {
  it("sums estimates, blockers and sites by stage", () => {
    const a = summarizeSite(input({ estimateCents: 100, issues: [issue("suspension", "block")] }));
    const b = summarizeSite(input({ siteId: "s2", estimateCents: 250, workstreams: all("approved") }));
    const t = portfolioTotals([a, b]);
    expect(t).toMatchObject({ sites: 2, estimateCents: 350, blocking: 1 });
    expect(t.byStage.setup).toBe(1);
    expect(t.byStage.ready_for_signoff).toBe(1);
  });
  it("handles an empty portfolio", () => {
    expect(portfolioTotals([])).toMatchObject({ sites: 0, estimateCents: 0, blocking: 0 });
  });
});

describe("portfolioCsv", () => {
  it("writes a header, one row per site, CRLF line ends and the estimate in dollars", () => {
    const csv = portfolioCsv([summarizeSite(input({ estimateCents: 123456 }))]);
    const lines = csv.trimEnd().split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("Estimate (CAD)");
    expect(lines[1]).toContain("1234.56");
  });
  it("quotes commas and quotes", () => {
    const csv = portfolioCsv([summarizeSite(input({ name: 'North "6-12", Unit' }))]);
    expect(csv).toContain('"North ""6-12"", Unit"');
  });
  it("neutralises spreadsheet formulas in text cells", () => {
    expect(portfolioCsv([summarizeSite(input({ name: "=HYPERLINK(\"http://x\")" }))])).toContain("\"'=HYPERLINK(");
    expect(portfolioCsv([summarizeSite(input({ name: "-2+3" }))])).toContain("'-2+3");
  });
});

describe("workItems", () => {
  it("lists only workstreams assigned to my organizations, with their issue counts", () => {
    const ids = Object.fromEntries(WORKSTREAM_KINDS.map((k) => [k, `ws-${k}`])) as Record<WorkstreamKind, string>;
    const statuses = Object.fromEntries(WORKSTREAM_KINDS.map((k) => [k, "in_progress"])) as Record<WorkstreamKind, WorkstreamStatus>;
    const items = workItems({
      siteId: "s1", siteName: "Demo", statuses, workstreamIds: ids,
      assignments: [
        { workstream_id: "ws-abandonment", org_id: "me" },
        { workstream_id: "ws-reclamation", org_id: "other" },
        { workstream_id: "ws-suspension", org_id: "me" },
      ],
      issues: [issue("abandonment", "block"), issue("abandonment", "warn"), issue("reclamation", "block")],
      myOrgIds: ["me"],
    });
    expect(items.map((i) => i.kind)).toEqual(["suspension", "abandonment"]);
    expect(items.find((i) => i.kind === "abandonment")).toMatchObject({ blocking: 1, warnings: 1 });
  });
});
