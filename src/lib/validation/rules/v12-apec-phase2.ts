import { hasAmount, isApplicable, isBlank, issue, linesOf, section5Applies } from "../helpers";
import type { Rule } from "../types";

/**
 * V-12 (Req. 21, 34): APECs from the Phase 1 ESA must be evaluated in a Phase 2 ESA.
 * The exception is restricted access, which needs a declaration and a restricted-access contingency.
 */
export const v12ApecPhase2: Rule = (ctx) => {
  if (!section5Applies(ctx) || !isApplicable(ctx, "esa_remediation")) return [];
  const d = ctx.details.esa_remediation;
  if (d.apecs.length === 0 || !isBlank(d.phase2OnestopId)) return [];
  const restrictedContingency =
    d.restrictedAccess.declared &&
    (["esa_remediation", "contingencies"] as const).some((k) =>
      linesOf(ctx, k).some((li) => li.contingencyKind === "restricted_access" && hasAmount(li)),
    );
  if (restrictedContingency) {
    return [
      issue("V-12", "warn", "Req. 21, 34", "esa_remediation",
        "APECs are not covered by a Phase 2 ESA; restricted access is declared and a restricted-access contingency is costed.",
        { field: "phase2OnestopId" }),
    ];
  }
  return [
    issue("V-12", "block", "Req. 21, 34", "esa_remediation",
      `${d.apecs.length} APEC(s) are listed but there is no Phase 2 ESA OneStop ID. Enter it, or declare restricted access and cost a restricted-access contingency.`,
      { field: "phase2OnestopId" }),
  ];
};
