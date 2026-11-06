import { isApplicable, isBlank, issue, remediationPresent, section5Applies } from "../helpers";
import type { Issue, Rule } from "../types";

/**
 * V-19 (Req. 24, 39(b), 40, 41, 42, 45): the remediation plan distinguishes on-site treatment from off-site
 * disposal, and the supporting detail is present for whichever approaches are used.
 */
export const v19TreatmentDetail: Rule = (ctx) => {
  if (!section5Applies(ctx) || !isApplicable(ctx, "esa_remediation")) return [];
  const d = ctx.details.esa_remediation;
  const out: Issue[] = [];
  const need = (req: string, field: string, ok: boolean, message: string) => {
    if (!ok) out.push(issue("V-19", "block", req, "esa_remediation", message, { field }));
  };

  if (remediationPresent(ctx) && !d.onSiteTreatment.planned && !d.offSiteDisposalPlanned) {
    out.push(
      issue("V-19", "block", "Req. 39(b)", "esa_remediation",
        "State whether affected soil is treated on site, disposed of off site, or both.", { field: "offSiteDisposalPlanned" }),
    );
  }

  const t = d.onSiteTreatment;
  if (t.planned) {
    need("Req. 41(a)", "onSiteTreatment.approach", !isBlank(t.approach), "On-site treatment: describe the approach and infrastructure needed.");
    need("Req. 41(b)", "onSiteTreatment.siteSuitability", !isBlank(t.siteSuitability), "On-site treatment: provide the assessment of site suitability.");
    need("Req. 41(c)", "onSiteTreatment.treatabilityResults", !isBlank(t.treatabilityResults), "On-site treatment: provide the soil treatability test results.");
    need("Req. 41(d)", "onSiteTreatment.volumeM3", t.volumeM3 !== null && t.volumeM3 > 0, "On-site treatment: enter the estimated volume requiring remediation.");
    need("Req. 41(d)", "onSiteTreatment.durationRationale", !isBlank(t.durationRationale), "On-site treatment: give the rationale used to predict treatment duration.");
  }

  const s = d.onSiteSystem;
  if (s.planned) {
    need("Req. 45(a)", "onSiteSystem.systemType", !isBlank(s.systemType), "On-site remediation system: state the type of system.");
    need("Req. 45(b)", "onSiteSystem.dimensions", !isBlank(s.dimensions), "On-site remediation system: give the system dimensions.");
    need("Req. 45(d)", "onSiteSystem.durationYears", s.durationYears !== null && s.durationYears > 0, "On-site remediation system: enter the predicted operating duration.");
    need("Req. 45(e)-(f)", "onSiteSystem.omCostsIncluded", s.omCostsIncluded, "On-site remediation system: confirm operation, maintenance and water disposal costs cover the full duration.");
    need("Req. 45(g)", "onSiteSystem.abandonmentCostsIncluded", s.abandonmentCostsIncluded, "On-site remediation system: confirm system abandonment costs are included.");
  }

  const g = d.groundwater;
  if (g.planned) {
    need("Req. 42(a)", "groundwater.sourceRemoval", !isBlank(g.sourceRemoval), "Groundwater: describe contaminant source removal.");
    need("Req. 42(b)", "groundwater.approach", !isBlank(g.approach), "Groundwater: describe the remediation approach.");
    need("Req. 42(c)", "groundwater.durationBasis", !isBlank(g.durationBasis), "Groundwater: give the basis for treatment or monitoring duration.");
    need("Req. 42(d)", "groundwater.totalVolumeM3", g.totalVolumeM3 !== null && g.totalVolumeM3 > 0, "Groundwater: enter the estimated total volume of affected groundwater.");
  }
  if (g.contaminationApparent && !g.lowerAquiferAssessed) {
    out.push(
      issue("V-19", "warn", "Req. 24", "esa_remediation",
        "Uppermost aquifer contamination is apparent: the next lower water-bearing zone must also be assessed.",
        { field: "groundwater.lowerAquiferAssessed" }),
    );
  }

  const p = d.inPlaceRemediation;
  if (p.planned) {
    need("Req. 40", "inPlaceRemediation.durationYears", p.durationYears !== null && p.durationYears > 0, "In-place remediation: estimate the time to remediate in place.");
    need("Req. 40", "inPlaceRemediation.supportingDocumentId",
      !isBlank(p.supportingDocumentId) && ctx.documents.some((doc) => doc.id === p.supportingDocumentId),
      "In-place remediation: attach supporting documentation for the time and cost estimate.");
  }
  return out;
};
