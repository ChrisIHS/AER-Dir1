import { overallStatus, type TrackerItem, type WorkstreamStatus } from "@/lib/tracker/tracker";
import type { OfficerSignatureState } from "@/lib/declaration";
import { WORKSTREAM_KINDS, type Issue, type SiteType, type WorkstreamKind } from "@/lib/validation/types";

export type Stage = "setup" | "in_progress" | "in_review" | "ready_for_signoff" | "signed" | "packaged";

export const STAGE_LABEL: Record<Stage, string> = {
  setup: "Setting up",
  in_progress: "In progress",
  in_review: "In review",
  ready_for_signoff: "Ready for sign-off",
  signed: "Signed",
  packaged: "Package built",
};
export const STAGE_ORDER: Stage[] = ["setup", "in_progress", "in_review", "ready_for_signoff", "signed", "packaged"];

export interface SiteSummaryInput {
  siteId: string;
  name: string;
  siteType: SiteType;
  licenceNumber: string;
  isLandfill: boolean;
  workstreams: Record<WorkstreamKind, { applicable: boolean; status: WorkstreamStatus; assigned: boolean }>;
  issues: Issue[];
  tracker: TrackerItem[];
  estimateCents: number;
  signoffs: { care_susp_aband: boolean; remediation_reclamation: boolean };
  officer: OfficerSignatureState;
  packageCount: number;
}

export interface SiteSummary {
  siteId: string;
  name: string;
  siteType: SiteType;
  licenceNumber: string;
  isLandfill: boolean;
  stage: Stage;
  approved: number;
  applicable: number;
  blocking: number;
  warnings: number;
  tracker: { red: number; amber: number; green: number; na: number };
  estimateCents: number;
  nextAction: string;
}

export function stageOf(i: SiteSummaryInput): Stage {
  const signed = i.signoffs.care_susp_aband && i.signoffs.remediation_reclamation;
  if (signed && i.packageCount > 0) return "packaged";
  if (signed) return "signed";
  const ws = WORKSTREAM_KINDS.map((k) => i.workstreams[k]).filter((w) => w.applicable);
  if (ws.length > 0 && ws.every((w) => w.status === "approved")) return "ready_for_signoff";
  if (ws.some((w) => w.status === "submitted")) return "in_review";
  if (ws.some((w) => w.status !== "not_started")) return "in_progress";
  return "setup";
}

function nextAction(i: SiteSummaryInput, stage: Stage, blocking: number): string {
  const ws = WORKSTREAM_KINDS.map((k) => i.workstreams[k]).filter((w) => w.applicable);
  switch (stage) {
    case "setup":
      return ws.some((w) => !w.assigned) ? "Assign workstreams to contractors" : "Waiting for contractors to start";
    case "in_progress": {
      const changes = ws.filter((w) => w.status === "changes_requested").length;
      if (changes > 0) return `${changes} workstream${changes === 1 ? "" : "s"} returned for changes`;
      return blocking > 0 ? `Fix ${blocking} blocking issue${blocking === 1 ? "" : "s"}` : "Contractors are working";
    }
    case "in_review": {
      const n = ws.filter((w) => w.status === "submitted").length;
      return `Review ${n} submitted workstream${n === 1 ? "" : "s"}`;
    }
    case "ready_for_signoff":
      return "Lead assessor to sign off";
    case "signed":
      if (i.officer === "stale") return "Estimate changed: senior officer must re-sign F035";
      if (i.officer === "none") return "Senior officer to sign F035, then build the package";
      return "Build the submission package";
    case "packaged": {
      const k = i.tracker.find((t) => t.ref === "k");
      return k && k.status === "red" ? "Send to ssla@aer.ca and record the AER system update" : "Complete";
    }
  }
}

export function summarizeSite(i: SiteSummaryInput): SiteSummary {
  const stage = stageOf(i);
  const ws = WORKSTREAM_KINDS.map((k) => i.workstreams[k]).filter((w) => w.applicable);
  const blocking = i.issues.filter((x) => x.severity === "block").length;
  const t = overallStatus(i.tracker);
  return {
    siteId: i.siteId,
    name: i.name,
    siteType: i.siteType,
    licenceNumber: i.licenceNumber,
    isLandfill: i.isLandfill,
    stage,
    approved: ws.filter((w) => w.status === "approved").length,
    applicable: ws.length,
    blocking,
    warnings: i.issues.filter((x) => x.severity === "warn").length,
    tracker: { red: t.red, amber: t.amber, green: t.green, na: t.na },
    estimateCents: i.estimateCents,
    nextAction: nextAction(i, stage, blocking),
  };
}

export interface PortfolioTotals {
  sites: number;
  estimateCents: number;
  blocking: number;
  byStage: Record<Stage, number>;
}

export function portfolioTotals(list: SiteSummary[]): PortfolioTotals {
  const byStage = Object.fromEntries(STAGE_ORDER.map((s) => [s, 0])) as Record<Stage, number>;
  for (const s of list) byStage[s.stage] += 1;
  return {
    sites: list.length,
    estimateCents: list.reduce((t, s) => t + s.estimateCents, 0),
    blocking: list.reduce((t, s) => t + s.blocking, 0),
    byStage,
  };
}

const csvCell = (v: string | number): string => {
  const s = String(v);
  // Neutralise spreadsheet formula injection as well as quoting
  const safe = /^[=+\-@\t\r]/.test(s) && typeof v === "string" ? `'${s}` : s;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function portfolioCsv(list: SiteSummary[]): string {
  const head = ["Site", "Licence", "Type", "Landfill", "Stage", "Workstreams approved", "Workstreams applicable", "Blocking issues", "Warnings", "Req. 58 complete", "Req. 58 in progress", "Req. 58 missing", "Estimate (CAD)", "Next action"];
  const rows = list.map((s) => [
    s.name, s.licenceNumber, s.siteType.replace("_", " "), s.isLandfill ? "yes" : "no", STAGE_LABEL[s.stage], s.approved, s.applicable,
    s.blocking, s.warnings, s.tracker.green, s.tracker.amber, s.tracker.red, (s.estimateCents / 100).toFixed(2), s.nextAction,
  ]);
  return [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

// ---------------------------------------------------------------- a contractor's work queue
export interface WorkItem {
  siteId: string;
  siteName: string;
  kind: WorkstreamKind;
  status: WorkstreamStatus;
  blocking: number;
  warnings: number;
}

/** Workstreams assigned to any of `myOrgIds` on one site, with their open issue counts. */
export function workItems(a: {
  siteId: string;
  siteName: string;
  statuses: Record<WorkstreamKind, WorkstreamStatus>;
  workstreamIds: Record<WorkstreamKind, string>;
  assignments: { workstream_id: string; org_id: string }[];
  issues: Issue[];
  myOrgIds: string[];
}): WorkItem[] {
  return WORKSTREAM_KINDS.filter((k) =>
    a.assignments.some((x) => x.workstream_id === a.workstreamIds[k] && a.myOrgIds.includes(x.org_id)),
  ).map((kind) => ({
    siteId: a.siteId,
    siteName: a.siteName,
    kind,
    status: a.statuses[kind],
    blocking: a.issues.filter((i) => i.workstream === kind && i.severity === "block").length,
    warnings: a.issues.filter((i) => i.workstream === kind && i.severity === "warn").length,
  }));
}
