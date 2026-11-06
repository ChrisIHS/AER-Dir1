import { excavationPlanned, isBlank, issue, section5Applies } from "../helpers";
import type { Issue, Rule } from "../types";

export const BULKING_MIN = 1.2;
export const BULKING_MAX = 1.4;

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

/** V-07 (Req. 29): excavation-bulking factor, typically 1.2 to 1.4 (inclusive); deviations must be substantiated. */
export const v07BulkingFactor: Rule = (ctx) => {
  if (!section5Applies(ctx) || !excavationPlanned(ctx)) return [];
  const v = ctx.details.esa_remediation.volumes;
  const out: Issue[] = [];
  const field = "volumes.bulkingFactor";
  if (v.bulkingFactor === null) {
    out.push(issue("V-07", "block", "Req. 29", "esa_remediation", "Enter the excavation-bulking factor applied to the in-situ soil volume.", { field }));
    return out;
  }
  const f = round6(v.bulkingFactor);
  const inRange = f >= BULKING_MIN && f <= BULKING_MAX;
  if (!inRange) {
    if (isBlank(v.bulkingJustification)) {
      out.push(
        issue("V-07", "block", "Req. 29", "esa_remediation",
          `Bulking factor ${f} is outside ${BULKING_MIN}-${BULKING_MAX}. Substantiate the deviation.`,
          { field: "volumes.bulkingJustification" }),
      );
    } else {
      out.push(
        issue("V-07", "info", "Req. 29", "esa_remediation",
          `Bulking factor ${f} is outside ${BULKING_MIN}-${BULKING_MAX}; the justification given will go to the AER.`,
          { field: "volumes.bulkingJustification" }),
      );
    }
  }
  if (isBlank(v.bulkingBasis)) {
    out.push(issue("V-07", "warn", "Req. 29", "esa_remediation", "Document the basis for the bulking factor.", { field: "volumes.bulkingBasis" }));
  }
  return out;
};
