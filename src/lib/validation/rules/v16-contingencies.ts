import { allLines, hasAmount, isBlank, issue, MIN_RATIONALE_CHARS } from "../helpers";
import type { ContingencyKind, Issue, Rule } from "../types";

const REQ: Record<ContingencyKind, string> = {
  general: "Req. 5(k)",
  missing_history: "Req. 20, 49",
  unevaluated: "Req. 26, 49",
  restricted_access: "Req. 34(a)",
};
const LABEL: Record<ContingencyKind, string> = {
  general: "general",
  missing_history: "missing-history",
  unevaluated: "unevaluated-issues",
  restricted_access: "restricted-access",
};
const MIXED = /(restricted access|missing (history|information|records)|unevaluated)/i;

/**
 * V-16 (Req. 5(k), 20, 26, 34(a), 49): contingencies are separate items, each with a rationale.
 * A declared condition (missing history, unevaluated issues, restricted access) needs its own contingency line.
 */
export const v16Contingencies: Rule = (ctx) => {
  const out: Issue[] = [];
  const lines = allLines(ctx);
  const costed = (k: ContingencyKind) => lines.some(({ line }) => line.contingencyKind === k && hasAmount(line));

  for (const { kind, line } of lines) {
    const ck = line.contingencyKind;
    if (!ck || !hasAmount(line)) continue;
    if ((line.rationale ?? "").trim().length < MIN_RATIONALE_CHARS) {
      out.push(
        issue("V-16", "block", REQ[ck], kind,
          `The ${LABEL[ck]} contingency needs a rationale (at least ${MIN_RATIONALE_CHARS} characters) that substantiates the amount.`,
          { lineItemId: line.id, field: "rationale" }),
      );
    }
    if (ck === "general" && MIXED.test(`${line.task} ${line.rationale ?? ""}`)) {
      out.push(
        issue("V-16", "warn", "Req. 34(a), 49", kind,
          "The general contingency mentions missing history, unevaluated issues or restricted access. Those need their own distinct contingency lines.",
          { lineItemId: line.id }),
      );
    }
  }

  const c = ctx.details.contingencies;
  if (c.missingHistoryDeclared) {
    if (!costed("missing_history")) {
      out.push(issue("V-16", "block", "Req. 20, 49", "contingencies", "Historical information is declared missing but there is no missing-history contingency line.", { field: "missingHistoryDeclared" }));
    }
    if (isBlank(c.missingHistorySearchMethods)) {
      out.push(issue("V-16", "block", "Req. 49", "contingencies", "Describe the methods used to search for the missing historical information.", { field: "missingHistorySearchMethods" }));
    }
  } else if (costed("missing_history")) {
    out.push(issue("V-16", "warn", "Req. 20, 49", "contingencies", "A missing-history contingency is costed but missing history is not declared.", { field: "missingHistoryDeclared" }));
  }

  if (c.unevaluatedIssuesDeclared) {
    if (!costed("unevaluated")) {
      out.push(issue("V-16", "block", "Req. 26, 49", "contingencies", "Unevaluated issues are declared but there is no unevaluated-issues contingency line.", { field: "unevaluatedIssuesDeclared" }));
    }
  } else if (costed("unevaluated")) {
    out.push(issue("V-16", "warn", "Req. 26, 49", "contingencies", "An unevaluated-issues contingency is costed but unevaluated issues are not declared.", { field: "unevaluatedIssuesDeclared" }));
  }

  const r = ctx.details.esa_remediation.restrictedAccess;
  if (r.declared) {
    if (!costed("restricted_access")) {
      out.push(issue("V-16", "block", "Req. 34(a)", "contingencies", "Restricted access is declared but there is no restricted-access contingency line. It must be distinct from the general contingency.", { field: "restrictedAccess.declared" }));
    }
    if (isBlank(r.rationale)) {
      out.push(issue("V-16", "block", "Req. 34(a)", "esa_remediation", "Document the rationale for the restricted scope of work.", { field: "restrictedAccess.rationale" }));
    }
  } else if (costed("restricted_access")) {
    out.push(issue("V-16", "warn", "Req. 34(a)", "contingencies", "A restricted-access contingency is costed but restricted access is not declared on the ESA workstream.", { field: "restrictedAccess.declared" }));
  }
  return out;
};
