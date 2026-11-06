import { allLines, hasAmount, issue } from "../helpers";
import type { Issue, Rule } from "../types";

/** The two Form 001-A rows that carry a scrap-metal credit. */
export const SCRAP_VALUE_ROW_KEYS: readonly string[] = [
  "001-A:ferrous_material_value",
  "001-A:nonferrous_material_value",
];

/** V-03 (Req. 12, 58(j)): a scrap-metal credit needs a supporting document and a rate sheet. */
export const v03ScrapSupport: Rule = (ctx) => {
  const out: Issue[] = [];
  const docIds = new Set(ctx.documents.map((d) => d.id));
  const sheetIds = new Set(ctx.rateSheets.map((r) => r.id));
  for (const { kind, line } of allLines(ctx)) {
    if (!line.formRowKey || !SCRAP_VALUE_ROW_KEYS.includes(line.formRowKey) || !hasAmount(line)) continue;
    if (!line.supportingDocumentId || !docIds.has(line.supportingDocumentId)) {
      out.push(
        issue("V-03", "block", "Req. 12", kind,
          "A scrap-metal credit needs a supporting document (for example a recycler's price list). Attach one.",
          { lineItemId: line.id }),
      );
    }
    if (!line.rateSheetId || !sheetIds.has(line.rateSheetId)) {
      out.push(
        issue("V-03", "block", "Req. 58(j)", kind,
          "A scrap-metal credit needs its third-party rate sheet in the submission. Link an uploaded rate sheet.",
          { lineItemId: line.id }),
      );
    }
  }
  return out;
};
