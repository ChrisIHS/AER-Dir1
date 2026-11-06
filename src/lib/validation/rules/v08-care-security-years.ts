import { hasAmount, issue, linesOf, lineYears } from "../helpers";
import type { Issue, Rule } from "../types";

export const MIN_CARE_YEARS = 3;
const EPS = 1e-9;

/**
 * V-08 (Req. 8): at least three years of reasonable care and measures AND of site security.
 * Read as two separate minimums (docs/PLAN.md section 8, assumption 2).
 * Durations are quantities with a unit of year/month/week/day on lines in the 'care' / 'security' categories.
 */
export const v08CareSecurityYears: Rule = (ctx) => {
  const out: Issue[] = [];
  if (!ctx.workstreams.care_security.applicable) {
    out.push(
      issue("V-08", "block", "Req. 8", "care_security",
        "Reasonable care and measures and site security can't be marked not applicable: Req. 8 requires a minimum of three years of each."),
    );
  }
  const lines = linesOf(ctx, "care_security").concat(
    // care/security lines are allowed on other workstreams too (e.g. a suspension contractor)
    (["suspension", "abandonment"] as const).flatMap((k) => linesOf(ctx, k)),
  );
  for (const [category, label] of [
    ["care", "reasonable care and measures"],
    ["security", "site security"],
  ] as const) {
    let years = 0;
    for (const li of lines) {
      if (li.costCategory !== category || !hasAmount(li)) continue;
      years += lineYears(li) ?? 0;
    }
    if (years + EPS < MIN_CARE_YEARS) {
      out.push(
        issue("V-08", "block", "Req. 8", "care_security",
          `${label[0]!.toUpperCase()}${label.slice(1)} is costed for ${Math.round(years * 100) / 100} year(s). The minimum is ${MIN_CARE_YEARS}. Quantities must use year, month, week or day units.`),
      );
    }
  }
  return out;
};
