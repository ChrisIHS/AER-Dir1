import { hasAmount, isApplicable, isBlank, issue, linesOf, section5Applies } from "../helpers";
import type { Issue, Rule } from "../types";

/** V-18 (Req. 32, 33): off-site disposal needs soil density, moisture content and the method used to determine them. */
export const v18DensityMoisture: Rule = (ctx) => {
  if (!section5Applies(ctx) || !isApplicable(ctx, "esa_remediation")) return [];
  const d = ctx.details.esa_remediation;
  const offSite =
    d.offSiteDisposalPlanned ||
    linesOf(ctx, "esa_remediation").some((li) => li.costCategory === "remediation_off_site" && hasAmount(li));
  if (!offSite) return [];
  const out: Issue[] = [];
  if (d.volumes.soilDensityTPerM3 === null) {
    out.push(issue("V-18", "block", "Req. 32", "esa_remediation", "Enter the soil density used to convert volume to tonnes for off-site disposal.", { field: "volumes.soilDensityTPerM3" }));
  }
  if (d.volumes.moisturePct === null) {
    out.push(issue("V-18", "block", "Req. 32", "esa_remediation", "Enter the moisture content of the soil requiring disposal.", { field: "volumes.moisturePct" }));
  }
  if (isBlank(d.volumes.densityMethod)) {
    out.push(issue("V-18", "block", "Req. 33", "esa_remediation", "Describe the method used to determine density and moisture content.", { field: "volumes.densityMethod" }));
  }
  return out;
};
