import { allLines, hasAmount, isBlank, issue } from "../helpers";
import type { Issue, LineItem, Rule } from "../types";

/** Percentage-based lines and contingencies have no third-party unit rate to source. */
export function needsRateSheet(li: LineItem): boolean {
  if (li.calcMode === "percent_of_base") return false;
  if (li.contingencyKind !== null || li.costCategory === "contingency") return false;
  return (li.unitRate ?? 0) !== 0 || hasAmount(li);
}

/** V-04 (Req. 3, 58(j)): every unit rate links to an uploaded third-party rate sheet. */
export const v04RateSheetLink: Rule = (ctx) => {
  const out: Issue[] = [];
  const sheetIds = new Set(ctx.rateSheets.map((r) => r.id));
  for (const { kind, line } of allLines(ctx)) {
    if (!needsRateSheet(line)) continue;
    if (!line.rateSheetId) {
      out.push(
        issue("V-04", "block", "Req. 3, 58(j)", kind,
          "No rate sheet is linked. Every unit rate must come from an uploaded third-party rate sheet.",
          { lineItemId: line.id, field: "rateSheetId" }),
      );
    } else if (!sheetIds.has(line.rateSheetId)) {
      out.push(
        issue("V-04", "block", "Req. 3, 58(j)", kind,
          "The linked rate sheet is not part of this site's uploads.",
          { lineItemId: line.id, field: "rateSheetId" }),
      );
    } else if (isBlank(line.rateSheetRef)) {
      out.push(
        issue("V-04", "block", "Req. 3, 58(j)", kind,
          "Add the page or line of the rate sheet this rate comes from.",
          { lineItemId: line.id, field: "rateSheetRef" }),
      );
    }
  }
  return out;
};
