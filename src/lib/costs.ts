import { FORM_ROW_BY_KEY } from "@/lib/forms/templateMap";
import { sumCents, toCents, type Cents } from "@/lib/money";
import { isFilled } from "@/lib/validation/helpers";
import type { FormRef, LineItem, ValidationContext, WorkstreamKind } from "@/lib/validation/types";
import { WORKSTREAM_KINDS } from "@/lib/validation/types";

/**
 * Form 001-A subtracts scrap-metal VALUE (rows 50-51) from the disposal subtotal; the entered
 * amounts are positive. Sorting and transport for scrap (rows 48-49) are ordinary costs.
 */
const SCRAP_CREDIT_KEYS = new Set([
  "001-A:ferrous_material_value",
  "001-A:nonferrous_material_value",
]);

/** A line's contribution to its form total, in cents (scrap value is a credit). */
export function signedCents(li: LineItem): Cents {
  const c = toCents(li.total);
  return li.formRowKey && SCRAP_CREDIT_KEYS.has(li.formRowKey) ? -c : c;
}

export interface CostSummary {
  byWorkstream: Record<WorkstreamKind, Cents>;
  byForm: Record<FormRef, Cents>;
  /** Per form, per template block (e.g. "transport_disposal"). Lines with no form row land in "unassigned". */
  byBlock: Record<FormRef, Record<string, Cents>>;
  scrapCredit: Cents;
  unassigned: { count: number; cents: Cents };
  grand: Cents;
}

export function summarizeCosts(ctx: ValidationContext): CostSummary {
  const byWorkstream = {} as Record<WorkstreamKind, Cents>;
  const byBlock: CostSummary["byBlock"] = { "001-A": {}, "001-B": {} };
  const byForm: Record<FormRef, Cents> = { "001-A": 0, "001-B": 0 };
  let scrapCredit = 0;
  let unassignedCount = 0;
  let unassignedCents = 0;

  for (const kind of WORKSTREAM_KINDS) {
    const lines = ctx.workstreams[kind].lineItems.filter(isFilled);
    byWorkstream[kind] = sumCents(lines.map(signedCents));
    for (const li of lines) {
      const amount = signedCents(li);
      byForm[li.formRef] += amount;
      const row = li.formRowKey ? FORM_ROW_BY_KEY.get(li.formRowKey) : undefined;
      const block = row?.block ?? "unassigned";
      byBlock[li.formRef][block] = (byBlock[li.formRef][block] ?? 0) + amount;
      if (!row) {
        unassignedCount += 1;
        unassignedCents += amount;
      }
      if (li.formRowKey && SCRAP_CREDIT_KEYS.has(li.formRowKey)) scrapCredit += toCents(li.total);
    }
  }
  return {
    byWorkstream,
    byForm,
    byBlock,
    scrapCredit,
    unassigned: { count: unassignedCount, cents: unassignedCents },
    grand: byForm["001-A"] + byForm["001-B"],
  };
}
