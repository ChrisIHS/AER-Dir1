import { isBlank, issue, remediationPresent, section5Applies } from "../helpers";
import type { Rule } from "../types";

/** V-13 (Req. 17, 58(d)): cite the Record of Site Condition OneStop ID. Warn only: an RoSC may not exist yet. */
export const v13RoscId: Rule = (ctx) => {
  if (!section5Applies(ctx) || !remediationPresent(ctx)) return [];
  if (!isBlank(ctx.details.esa_remediation.roscOnestopId)) return [];
  return [
    issue("V-13", "warn", "Req. 17, 58(d)", "esa_remediation",
      "No Record of Site Condition OneStop submission ID is entered. Include it in the supporting documentation when one exists.",
      { field: "roscOnestopId" }),
  ];
};
