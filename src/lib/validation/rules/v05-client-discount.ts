import { allLines, issue } from "../helpers";
import type { Issue, Rule } from "../types";

/**
 * V-05 (Req. 3, 58(j)): client-specific or multi-site discounts may not be applied.
 * Block (not just flag) because Req. 3 says such discounts "may not be applied".
 */
export const v05ClientDiscount: Rule = (ctx) => {
  const out: Issue[] = [];
  const bad = new Map(
    ctx.rateSheets.filter((r) => r.discountType === "client_specific" || r.discountType === "multi_site").map((r) => [r.id, r]),
  );
  for (const { kind, line } of allLines(ctx)) {
    const sheet = line.rateSheetId ? bad.get(line.rateSheetId) : undefined;
    if (!sheet) continue;
    const what = sheet.discountType === "client_specific" ? "client-specific" : "multi-site";
    out.push(
      issue("V-05", "block", "Req. 3", kind,
        `Rate sheet "${sheet.title}" includes a ${what} discount. Use undiscounted third-party rates; only discounts available to all parties are allowed.`,
        { lineItemId: line.id, field: "rateSheetId" }),
    );
  }
  return out;
};
