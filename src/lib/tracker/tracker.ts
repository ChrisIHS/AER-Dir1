import { isBlank, remediationPresent } from "@/lib/validation/helpers";
import type { DocumentKind, Issue, ValidationContext, WorkstreamKind } from "@/lib/validation/types";
import { WORKSTREAM_KINDS } from "@/lib/validation/types";

export type Rag = "red" | "amber" | "green" | "na";
export type WorkstreamStatus = "not_started" | "in_progress" | "submitted" | "changes_requested" | "approved";

export interface TrackerItem {
  /** Req. 58 reference: "a"-"k", with g split into "g.i", "g.ii", "g.iii". */
  ref: string;
  title: string;
  req: string;
  status: Rag;
  owner: string | null;
  detail: string;
}

export interface TrackerInput {
  ctx: ValidationContext;
  issues: Issue[];
  workstreamStatus: Record<WorkstreamKind, WorkstreamStatus>;
  /** Display names. Workstream owner = the assigned org/person; licensee and assessor are site-level. */
  owners: { workstream: Record<WorkstreamKind, string | null>; licensee: string | null; leadAssessor: string | null };
  /** Facts the app cannot derive; recorded manually by the licensee admin / assessor. */
  manual: {
    liabilityDeclaration: "none" | "generated" | "signed"; // F035, signed by a senior officer (Req. 58(g)(i))
    costFormsGenerated: boolean; // Forms 001-A / 001-B exported (58(g)(ii))
    signoffs: { care_susp_aband: boolean; remediation_reclamation: boolean }; // 58(g)(iii)
    supportingInfoNoneRequiredReason: string | null; // 58(i)
    aerSystemUpdate: { date: string; reference: string } | null; // 58(k)
  };
}

const hasBlock = (issues: Issue[], kind: WorkstreamKind) => issues.some((i) => i.workstream === kind && i.severity === "block");
const hasDoc = (ctx: ValidationContext, kind: DocumentKind) => ctx.documents.some((d) => d.kind === kind);

/** Red = missing or blocked. Amber = present but warnings / awaiting approval. Green = present, valid and approved. */
function planItem(
  inp: TrackerInput, ref: string, title: string, req: string, docKind: DocumentKind, ws: WorkstreamKind,
): TrackerItem {
  const owner = inp.owners.workstream[ws];
  if (!inp.ctx.workstreams[ws].applicable) {
    return { ref, title, req, status: "na", owner, detail: "Workstream marked not applicable." };
  }
  if (!hasDoc(inp.ctx, docKind)) return { ref, title, req, status: "red", owner, detail: "Plan document not uploaded." };
  if (hasBlock(inp.issues, ws)) return { ref, title, req, status: "red", owner, detail: "Workstream has blocking issues." };
  if (inp.workstreamStatus[ws] !== "approved") {
    return { ref, title, req, status: "amber", owner, detail: "Plan uploaded; workstream not yet approved." };
  }
  return { ref, title, req, status: "green", owner, detail: "Plan uploaded and workstream approved." };
}

export function computeTracker(inp: TrackerInput): TrackerItem[] {
  const { ctx, issues, owners, manual, workstreamStatus } = inp;
  const items: TrackerItem[] = [];
  const esa = ctx.details.esa_remediation;
  const esaOwner = owners.workstream.esa_remediation;
  const remediation = remediationPresent(ctx);

  items.push(planItem(inp, "a", "Suspension plan", "Req. 58(a)", "suspension_plan", "suspension"));

  if (ctx.site.siteType !== "pipeline") {
    items.push({ ref: "b", title: "Discontinuation plan (pipelines only)", req: "Req. 58(b)", status: "na", owner: null, detail: "Not a pipeline." });
  } else {
    items.push(planItem(inp, "b", "Discontinuation plan (pipelines only)", "Req. 58(b)", "discontinuation_plan", "suspension"));
  }

  items.push(planItem(inp, "c", "Abandonment plan", "Req. 58(c)", "abandonment_plan", "abandonment"));

  // d: Phase 1 / Phase 2 ESA with RoSC (OneStop submission IDs)
  if (ctx.site.isLandfill || !ctx.workstreams.esa_remediation.applicable) {
    items.push({ ref: "d", title: "Phase 1 and Phase 2 ESA with RoSC", req: "Req. 58(d)", status: "na", owner: esaOwner,
      detail: ctx.site.isLandfill ? "Landfill: only Req. 14 applies (Req. 15)." : "ESA workstream marked not applicable." });
  } else {
    const missing: string[] = [];
    if (isBlank(esa.phase1OnestopId)) missing.push("Phase 1 ID");
    if (esa.apecs.length > 0 && isBlank(esa.phase2OnestopId)) missing.push("Phase 2 ID");
    const roscMissing = isBlank(esa.roscOnestopId);
    let status: Rag;
    let detail: string;
    if (missing.length > 0) {
      status = "red";
      detail = `Missing: ${missing.join(", ")}.`;
    } else if (roscMissing || workstreamStatus.esa_remediation !== "approved") {
      status = "amber";
      detail = roscMissing ? "No RoSC ID yet." : "IDs entered; ESA workstream not yet approved.";
    } else {
      status = "green";
      detail = "OneStop IDs entered and workstream approved.";
    }
    items.push({ ref: "d", title: "Phase 1 and Phase 2 ESA with RoSC", req: "Req. 58(d)", status, owner: esaOwner, detail });
  }

  // e: remediation plan
  if (ctx.site.isLandfill || !remediation) {
    items.push({ ref: "e", title: "Remediation plan", req: "Req. 58(e)", status: "na", owner: esaOwner,
      detail: ctx.site.isLandfill ? "Landfill: only Req. 14 applies (Req. 15)." : "No remediation costs entered." });
  } else {
    items.push(planItem(inp, "e", "Remediation plan", "Req. 58(e)", "remediation_plan", "esa_remediation"));
  }

  items.push(planItem(inp, "f", "Reclamation plan", "Req. 58(f)", "reclamation_plan", "reclamation"));

  // g.i Liability Declaration (F035)
  items.push({
    ref: "g.i", title: "Liability Declaration Form (F035)", req: "Req. 58(g)(i)", owner: owners.licensee,
    status: manual.liabilityDeclaration === "signed" ? "green" : manual.liabilityDeclaration === "generated" ? "amber" : "red",
    detail: { none: "Not generated.", generated: "Generated; awaiting senior officer signature.", signed: "Signed." }[manual.liabilityDeclaration],
  });

  // g.ii Cost estimate forms 001-A / 001-B
  const notApproved = WORKSTREAM_KINDS.filter((k) => ctx.workstreams[k].applicable && workstreamStatus[k] !== "approved");
  items.push({
    ref: "g.ii", title: "Cost Estimate Forms 001-A and 001-B", req: "Req. 58(g)(ii)", owner: owners.licensee,
    status: notApproved.length > 0 ? "red" : manual.costFormsGenerated ? "green" : "amber",
    detail: notApproved.length > 0
      ? `Waiting for approval of: ${notApproved.join(", ")}.`
      : manual.costFormsGenerated ? "Forms generated." : "All workstreams approved; forms not yet generated.",
  });

  // g.iii Acknowledgement statements (lead assessor)
  const needRem = ctx.workstreams.esa_remediation.applicable || ctx.workstreams.reclamation.applicable;
  const done = [manual.signoffs.care_susp_aband, needRem ? manual.signoffs.remediation_reclamation : true];
  items.push({
    ref: "g.iii", title: "Acknowledgement Statements (lead assessor)", req: "Req. 58(g)(iii), 52-57", owner: owners.leadAssessor,
    status: done.every(Boolean) ? "green" : done.some(Boolean) ? "amber" : "red",
    detail: done.every(Boolean) ? "Signed off." : `Signed ${done.filter(Boolean).length} of ${done.length}.`,
  });

  // h: detailed estimated costs
  const blocked = issues.some((i) => i.severity === "block");
  items.push({
    ref: "h", title: "Detailed estimated costs", req: "Req. 58(h)", owner: owners.leadAssessor,
    status: blocked ? "red" : notApproved.length > 0 ? "amber" : "green",
    detail: blocked ? "Blocking validation issues remain." : notApproved.length > 0 ? "No blockers; some workstreams not yet approved." : "All workstreams approved with no blockers.",
  });

  // i: additional supporting information
  const hasSupport = hasDoc(ctx, "supporting");
  items.push({
    ref: "i", title: "Additional supporting information", req: "Req. 58(i)", owner: owners.licensee,
    status: hasSupport || !isBlank(manual.supportingInfoNoneRequiredReason) ? "green" : "amber",
    detail: hasSupport ? "Supporting documents uploaded." : !isBlank(manual.supportingInfoNoneRequiredReason) ? "Recorded as not required." : "Upload supporting documents (e.g. hazardous materials survey) or record why none are needed.",
  });

  // j: third-party rate sheets
  const rateBlocks = issues.some((i) => i.ruleId === "V-04" && i.severity === "block");
  const discount = issues.some((i) => (i.ruleId === "V-05" && i.severity === "block") || i.ruleId === "V-06");
  const used = new Set(WORKSTREAM_KINDS.flatMap((k) => ctx.workstreams[k].lineItems.map((l) => l.rateSheetId)).filter(Boolean));
  const unreferenced = ctx.rateSheets.filter((r) => !used.has(r.id));
  items.push({
    ref: "j", title: "Third-party rate sheets", req: "Req. 58(j)", owner: owners.licensee,
    status: rateBlocks || (ctx.rateSheets.length === 0 && used.size > 0) ? "red" : discount || unreferenced.length > 0 ? "amber" : "green",
    detail: rateBlocks ? "Some rates are not linked to an uploaded rate sheet."
      : discount ? "Rate sheet discount or date issues to review."
      : unreferenced.length > 0 ? `${unreferenced.length} uploaded rate sheet(s) are not referenced by any line.` : "Every rate is linked to an uploaded rate sheet.",
  });

  // k: AER system update
  items.push({
    ref: "k", title: "Estimate entered in the AER's designated system", req: "Req. 58(k)", owner: owners.licensee,
    status: manual.aerSystemUpdate ? "green" : "red",
    detail: manual.aerSystemUpdate ? `Entered ${manual.aerSystemUpdate.date} (ref ${manual.aerSystemUpdate.reference}).` : "Not yet recorded.",
  });

  return items;
}

export function overallStatus(items: TrackerItem[]): { red: number; amber: number; green: number; na: number; ready: boolean } {
  const c = { red: 0, amber: 0, green: 0, na: 0 };
  for (const i of items) c[i.status] += 1;
  return { ...c, ready: c.red === 0 && c.amber === 0 };
}
