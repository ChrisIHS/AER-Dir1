import { isApplicable, isBlank, issue, section5Applies } from "../helpers";
import type { Rule } from "../types";

/** V-11 (Req. 37): a Tier 2 approach needs its assessment submitted through OneStop first (submission ID). */
export const v11Tier2Id: Rule = (ctx) => {
  if (!section5Applies(ctx) || !isApplicable(ctx, "esa_remediation")) return [];
  const d = ctx.details.esa_remediation;
  if (d.remediationApproach !== "tier2" || !isBlank(d.tier2OnestopId)) return [];
  return [
    issue("V-11", "block", "Req. 37", "esa_remediation",
      "A Tier 2 approach needs the OneStop submission ID of the Tier 2 assessment work.",
      { field: "tier2OnestopId" }),
  ];
};
