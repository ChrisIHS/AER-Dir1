import { allLines, hasAmount, issue, MIN_RATIONALE_CHARS } from "../helpers";
import { REQ_5_ITEMS, REQ_5_LABELS } from "@/lib/workstreams/details";
import type { Issue, Rule } from "../types";

/**
 * V-15 (Req. 5): management and administration costs (a)-(k) are provided for every project.
 * An item is satisfied by a line tagged with that letter and a cost, or by a written reason for zero.
 * Item (k) general contingency is also satisfied by a costed general contingency line anywhere.
 */
export const v15Req5Items: Rule = (ctx) => {
  const out: Issue[] = [];
  const lines = allLines(ctx).map((x) => x.line);
  const zero = ctx.details.mgmt_admin.req5ZeroRationale;
  for (const item of REQ_5_ITEMS) {
    const costed = lines.some(
      (li) =>
        hasAmount(li) &&
        (li.req5Item === item || (item === "k" && li.contingencyKind === "general")),
    );
    const reason = (zero[item] ?? "").trim();
    if (costed || reason.length >= MIN_RATIONALE_CHARS) continue;
    out.push(
      issue("V-15", "block", `Req. 5(${item})`, "mgmt_admin",
        `Management/administration item (${item}) "${REQ_5_LABELS[item]}" has no cost. Add a cost, or explain why it is zero.`,
        { field: `req5ZeroRationale.${item}` }),
    );
  }
  return out;
};
