import { cents, issue, allLines } from "../helpers";
import type { Issue, Rule } from "../types";

/** V-02 (Req. 12): no credit or discount for salvage value from the resale of equipment. */
export const SALVAGE_KEYWORDS = /\b(salvage|resale|re-sale|resell|resold)\b/i;

export const v02NoSalvage: Rule = (ctx) => {
  const out: Issue[] = [];
  for (const { kind, line } of allLines(ctx)) {
    if (line.costCategory === "salvage_resale") {
      out.push(
        issue("V-02", "block", "Req. 12", kind,
          "Salvage or resale credits are not allowed. Only a scrap-metal credit with supporting information can be included.",
          { lineItemId: line.id }),
      );
    } else if (cents(line) < 0) {
      out.push(
        issue("V-02", "block", "Req. 12", kind,
          "Negative amounts (credits) are not allowed. Scrap metal is entered as a positive value on the scrap-metal rows.",
          { lineItemId: line.id }),
      );
    }
    if (SALVAGE_KEYWORDS.test(`${line.task} ${line.notes ?? ""}`)) {
      out.push(
        issue("V-02", "warn", "Req. 12", kind,
          "The task or notes mention salvage or resale. Make sure no resale credit is applied.",
          { lineItemId: line.id }),
      );
    }
  }
  return out;
};
