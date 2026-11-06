import { excavationPlanned, isBlank, issue, section5Applies } from "../helpers";
import type { Issue, Rule } from "../types";

/** V-17 (Req. 28, 31): document the plume irregularity factor and attach the site drawing with sample points. */
export const v17VolumeBasis: Rule = (ctx) => {
  if (!section5Applies(ctx) || !excavationPlanned(ctx)) return [];
  const v = ctx.details.esa_remediation.volumes;
  const out: Issue[] = [];
  if (v.plumeIrregularityFactor === null) {
    out.push(issue("V-17", "block", "Req. 28", "esa_remediation", "Enter the plume irregularity factor (or similar methodology) used to estimate in-situ soil volume.", { field: "volumes.plumeIrregularityFactor" }));
  }
  if (isBlank(v.plumeBasis)) {
    out.push(issue("V-17", "block", "Req. 28", "esa_remediation", "Document the basis for the plume irregularity factor.", { field: "volumes.plumeBasis" }));
  }
  if (!ctx.documents.some((d) => d.kind === "site_drawing")) {
    out.push(issue("V-17", "block", "Req. 31", "esa_remediation", "Attach the site drawing showing the affected areas outlined and the sample points."));
  }
  return out;
};
