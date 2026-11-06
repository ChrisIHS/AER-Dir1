import { isBlank } from "@/lib/validation/helpers";
import type { Issue, WorkstreamKind } from "@/lib/validation/types";
import { WORKSTREAM_KINDS } from "@/lib/validation/types";
import type { WorkstreamStatus } from "@/lib/tracker/tracker";

/** Bump when the wording below changes; stored with each sign-off. */
export const STATEMENT_TEXT_VERSION = "2025-02";

export const STATEMENT_TEXT = {
  /** Req. 54: certification that the lead assessor prepared or supervised the assessment. */
  req54: "I certify that I prepared or supervised this liability assessment.",
  /** Req. 56: the signatory statement. */
  req56:
    "This report was completed in accordance with the specified standard (AER Directive 001, February 2025), and it clearly documents all conditions that materially limit the scope of the assessment or the accuracy of the cost estimate.",
  /** Req. 57: authorized users, if the report limits use by other parties. */
  req57: "The Alberta Energy Regulator and Alberta Environment and Protected Areas are authorized users of this report.",
} as const;

export interface SignoffCheckInput {
  assessmentDate: string | null;
  limitationsText: string | null;
  personnel: { name: string | null; role: string | null; technical_training: string | null; experience: string | null }[];
  credentials: { association: string; registration_no: string; good_standing_attested_at: string | null }[];
  workstreams: Record<WorkstreamKind, { applicable: boolean; status: WorkstreamStatus }>;
  issues: Issue[];
  /** Ticked by the signer on the sign-off form. */
  acknowledged: { req54: boolean; req56: boolean; req57: boolean };
}

export interface SignoffProblem {
  ruleId: "V-22" | "V-23" | "GATE";
  req: string;
  message: string;
}

/**
 * V-22 and V-23 (docs/PLAN.md 4.3) plus the preconditions the database also enforces. Every item must
 * be clear before the lead assessor can sign either acknowledgement statement.
 */
export function checkSignoff(inp: SignoffCheckInput): SignoffProblem[] {
  const out: SignoffProblem[] = [];
  const add = (ruleId: SignoffProblem["ruleId"], req: string, message: string) => out.push({ ruleId, req, message });

  // Gate: the whole assessment is approved with nothing blocking
  const open = WORKSTREAM_KINDS.filter((k) => inp.workstreams[k].applicable && inp.workstreams[k].status !== "approved");
  if (open.length > 0) add("GATE", "Req. 52", `Every applicable workstream must be approved before sign-off. Still open: ${open.join(", ")}.`);
  const blockers = inp.issues.filter((i) => i.severity === "block").length;
  if (blockers > 0) add("GATE", "Req. 58(h)", `${blockers} blocking validation issue${blockers === 1 ? "" : "s"} remain.`);

  // V-22: Req. 48, 51-53
  if (isBlank(inp.assessmentDate)) add("V-22", "Req. 58", "Set the assessment date.");
  if (isBlank(inp.limitationsText)) {
    add("V-22", "Req. 48", "Document, in the limitations section, any deviation from the standard or any condition that limits the scope of the assessment or the accuracy of the estimate (or state that there are none).");
  }
  if (inp.personnel.length === 0) {
    add("V-22", "Req. 51", "Record every person involved: their role, technical training and previous experience.");
  }
  inp.personnel.forEach((p, i) => {
    const missing = (["name", "role", "technical_training", "experience"] as const).filter((f) => isBlank(p[f]));
    if (missing.length > 0) add("V-22", "Req. 51", `Personnel row ${i + 1}${p.name ? ` (${p.name})` : ""} is missing: ${missing.join(", ").replace(/_/g, " ")}.`);
  });
  if (inp.credentials.length === 0) {
    add("V-22", "Req. 53", "Record your professional designation (APEGA, AIA, ASET, ASPB, ACPA, AAFMP, or another recognised certification) and registration number.");
  } else if (!inp.credentials.some((c) => !isBlank(c.registration_no) && c.good_standing_attested_at)) {
    add("V-22", "Req. 53", "Attest that you are a member in good standing of the association you registered.");
  }

  // V-23: Req. 54-57
  if (!inp.acknowledged.req54) add("V-23", "Req. 54", "Tick the certification that you prepared or supervised the assessment.");
  if (!inp.acknowledged.req56) add("V-23", "Req. 56", "Tick the signatory statement (completed in accordance with the standard; limiting conditions documented).");
  if (!inp.acknowledged.req57) add("V-23", "Req. 57", "Tick the statement naming the AER and AEPA as authorized users of the report.");

  return out;
}
