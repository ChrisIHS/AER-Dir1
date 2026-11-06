import { isBlank, issue, linesOf } from "../helpers";
import type { Issue, Rule } from "../types";
import { WORKSTREAM_KINDS } from "../types";

/** V-01 (Req. 4): no net present value or discounting of future work. */
export const NPV_KEYWORDS = /\b(npv|net present value|discount rate|discounted|escalat\w*|inflation|inflated)\b/i;

export const v01NoNpv: Rule = (ctx) => {
  const out: Issue[] = [];
  for (const kind of WORKSTREAM_KINDS) {
    const lines = linesOf(ctx, kind);
    if (lines.length > 0 && !ctx.details[kind].attestations.noNpvDiscount) {
      out.push(
        issue("V-01", "block", "Req. 4", kind,
          "Confirm that no net present value, discounting or escalation was applied to this workstream.",
          { field: "attestations.noNpvDiscount" }),
      );
    }
    for (const li of lines) {
      if ((li.discountPctApplied ?? 0) !== 0 || (li.escalationPctApplied ?? 0) !== 0) {
        out.push(
          issue("V-01", "block", "Req. 4", kind,
            "A discount or escalation rate is entered. Costs must be undiscounted, current-day amounts with no net present value.",
            { lineItemId: li.id }),
        );
      }
      if (NPV_KEYWORDS.test(`${li.task} ${li.notes ?? ""}`) && !isBlank(li.task + (li.notes ?? ""))) {
        out.push(
          issue("V-01", "warn", "Req. 4", kind,
            "The task or notes mention discounting, escalation or net present value. Req. 4 does not allow it.",
            { lineItemId: li.id }),
        );
      }
    }
  }
  return out;
};
