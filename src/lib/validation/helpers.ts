import { toCents } from "@/lib/money";
import { FORM_ROW_BY_KEY } from "@/lib/forms/templateMap";
import type { Issue, LineItem, ValidationContext, WorkstreamKind } from "./types";
import { WORKSTREAM_KINDS } from "./types";

export const MIN_RATIONALE_CHARS = 15;

export const isBlank = (s: string | null | undefined): boolean => !s || s.trim().length === 0;

/** A line the user has actually filled in (empty placeholder rows are ignored by every rule). */
export function isFilled(li: LineItem): boolean {
  return (
    !isBlank(li.task) ||
    li.quantity !== null ||
    li.unitRate !== null ||
    li.total !== 0 ||
    li.formRowKey !== null
  );
}

export function linesOf(ctx: ValidationContext, kind: WorkstreamKind): LineItem[] {
  return ctx.workstreams[kind].lineItems.filter(isFilled);
}

export function allLines(ctx: ValidationContext): { kind: WorkstreamKind; line: LineItem }[] {
  return WORKSTREAM_KINDS.flatMap((kind) => linesOf(ctx, kind).map((line) => ({ kind, line })));
}

export const cents = (li: LineItem): number => toCents(li.total);
export const hasAmount = (li: LineItem): boolean => cents(li) > 0;

export function issue(
  ruleId: string,
  severity: Issue["severity"],
  req: string,
  workstream: WorkstreamKind,
  message: string,
  extra: Pick<Issue, "lineItemId" | "field"> = {},
): Issue {
  return { ruleId, severity, req, workstream, message, ...extra };
}

/** Block rules never run against a workstream the licensee has marked not applicable. */
export function isApplicable(ctx: ValidationContext, kind: WorkstreamKind): boolean {
  return ctx.workstreams[kind].applicable;
}

/** Req. 15: landfills only have to meet Req. 14 in section 5 (remediation and reclamation). */
export function section5Applies(ctx: ValidationContext): boolean {
  return !ctx.site.isLandfill;
}

export function formBlock(li: LineItem): string | null {
  return li.formRowKey ? (FORM_ROW_BY_KEY.get(li.formRowKey)?.block ?? null) : null;
}

/** Remediation costs exist when any ESA/remediation line is an on-site/off-site/backfill/overburden cost. */
export function remediationPresent(ctx: ValidationContext): boolean {
  if (!isApplicable(ctx, "esa_remediation")) return false;
  const cats = new Set(["remediation_on_site", "remediation_off_site", "backfill_import", "overburden_topsoil_handling"]);
  const blocks = new Set(["on_site_remediation", "off_site_transport_disposal"]);
  return linesOf(ctx, "esa_remediation").some(
    (li) => (cats.has(li.costCategory) || blocks.has(formBlock(li) ?? "")) && hasAmount(li),
  );
}

/** Excavation is planned when an in-situ affected soil volume has been entered (Req. 27, 29). */
export function excavationPlanned(ctx: ValidationContext): boolean {
  const v = ctx.details.esa_remediation.volumes.affectedInSituM3;
  return isApplicable(ctx, "esa_remediation") && v !== null && v > 0;
}

const YEAR_FACTORS: Record<string, number> = {
  year: 1,
  years: 1,
  yr: 1,
  yrs: 1,
  month: 1 / 12,
  months: 1 / 12,
  mo: 1 / 12,
  week: 1 / 52,
  weeks: 1 / 52,
  wk: 1 / 52,
  day: 1 / 365,
  days: 1 / 365,
};

/** Duration in years represented by a line (quantity of year/month/week/day units), or null. */
export function lineYears(li: LineItem): number | null {
  if (li.quantity === null || li.unit === null) return null;
  const f = YEAR_FACTORS[li.unit.trim().toLowerCase()];
  return f === undefined ? null : li.quantity * f;
}
