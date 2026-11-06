import { isBlank, issue, remediationPresent, section5Applies } from "../helpers";
import type { Rule } from "../types";

/**
 * V-10 (Req. 17, 19, 58(d)): remediation costs require a Phase 1 ESA, cited by its OneStop submission ID.
 * Req. 19 requires the SSLA to be based on a Phase 1 ESA; Req. 17 and 58(d) require the ID.
 */
export const v10Phase1Id: Rule = (ctx) => {
  if (!section5Applies(ctx) || !remediationPresent(ctx)) return [];
  if (!isBlank(ctx.details.esa_remediation.phase1OnestopId)) return [];
  return [
    issue("V-10", "block", "Req. 17, 19, 58(d)", "esa_remediation",
      "Remediation is costed but no Phase 1 ESA OneStop submission ID is entered.",
      { field: "phase1OnestopId" }),
  ];
};
