import type { TrackerItem } from "@/lib/tracker/tracker";
import type { DocumentKind, Issue } from "@/lib/validation/types";

export interface PackageProblem {
  ruleId: "V-25" | "PKG";
  req: string;
  message: string;
}

/** Req. 17: these are cited by OneStop ID, never submitted with an SSLA. */
export const FORBIDDEN_DOC_KINDS: readonly DocumentKind[] = ["remedial_action_plan", "contamination_mgmt_report"];

/**
 * Tracker items the package depends on. The Liability Declaration (g.i), the cost forms flag (g.ii),
 * supporting information (i) and the AER-system update (k) are completed around the package, not before it.
 */
const REQUIRED_REFS = ["a", "b", "c", "d", "e", "f", "g.iii", "h", "j"];

/** V-25 and the package gate: what must be true before the submission package can be built. */
export function checkPackage(input: {
  tracker: TrackerItem[];
  issues: Issue[];
  documents: { kind: DocumentKind; title: string }[];
}): PackageProblem[] {
  const out: PackageProblem[] = [];

  for (const d of input.documents) {
    if (FORBIDDEN_DOC_KINDS.includes(d.kind)) {
      out.push({
        ruleId: "V-25",
        req: "Req. 17",
        message: `"${d.title}" must not be submitted with an SSLA. Delete it and cite its OneStop submission ID on the ESA workstream instead.`,
      });
    }
  }

  const blockers = input.issues.filter((i) => i.severity === "block").length;
  if (blockers > 0) out.push({ ruleId: "PKG", req: "Req. 58(h)", message: `${blockers} blocking validation issue${blockers === 1 ? "" : "s"} remain.` });

  for (const t of input.tracker) {
    if (!REQUIRED_REFS.includes(t.ref)) continue;
    if (t.status === "red" || t.status === "amber") {
      out.push({ ruleId: "PKG", req: t.req, message: `${t.ref}. ${t.title}: ${t.detail}` });
    }
  }
  return out;
}
