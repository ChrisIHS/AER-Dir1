import { RULES } from "./rules";
import type { Issue, Rule, ValidationContext, WorkstreamKind } from "./types";
import { WORKSTREAM_KINDS } from "./types";

const SEVERITY_ORDER = { block: 0, warn: 1, info: 2 } as const;

/**
 * Run every rule. Issues on a workstream the licensee marked "not applicable" are dropped
 * (Directive 001 sections 4 and 5: requirements apply only when the task applies to the site),
 * except V-08, which flags that care and security can't be marked not applicable.
 */
export function validate(ctx: ValidationContext, rules: Record<string, Rule> = RULES): Issue[] {
  const issues = Object.values(rules).flatMap((rule) => rule(ctx));
  return issues
    .filter((i) => ctx.workstreams[i.workstream].applicable || i.ruleId === "V-08")
    .sort(
      (a, b) =>
        SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
        a.ruleId.localeCompare(b.ruleId) ||
        (a.lineItemId ?? "").localeCompare(b.lineItemId ?? ""),
    );
}

export const blockers = (issues: Issue[]): Issue[] => issues.filter((i) => i.severity === "block");

export const issuesFor = (issues: Issue[], kind: WorkstreamKind): Issue[] =>
  issues.filter((i) => i.workstream === kind);

/** A workstream can be submitted for review only when none of its issues blocks. */
export function canSubmit(issues: Issue[], kind: WorkstreamKind): boolean {
  return blockers(issuesFor(issues, kind)).length === 0;
}

export function countsByWorkstream(issues: Issue[]): Record<WorkstreamKind, { block: number; warn: number; info: number }> {
  const out = Object.fromEntries(WORKSTREAM_KINDS.map((k) => [k, { block: 0, warn: 0, info: 0 }])) as Record<
    WorkstreamKind,
    { block: number; warn: number; info: number }
  >;
  for (const i of issues) out[i.workstream][i.severity] += 1;
  return out;
}
