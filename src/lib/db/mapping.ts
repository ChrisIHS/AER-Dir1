import type { LineItem } from "@/lib/validation/types";
import type { Req5Item } from "@/lib/workstreams/details";
import { REQ_5_ITEMS } from "@/lib/workstreams/details";
import type { LineItemRow } from "./types";

const num = (v: number | string | null | undefined): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

/** snake_case database row -> the camelCase shape the validation rules read. */
export function rowToLineItem(r: LineItemRow): LineItem {
  const req5 = REQ_5_ITEMS.find((i) => i === r.req5_item) as Req5Item | undefined;
  return {
    id: r.id,
    formRef: r.form_ref,
    formRowKey: r.form_row_key,
    costCategory: r.cost_category,
    task: r.task ?? "",
    calcMode: r.calc_mode,
    quantity: num(r.quantity),
    unit: r.unit,
    unitRate: num(r.unit_rate),
    total: num(r.total) ?? 0,
    rateSheetId: r.rate_sheet_id,
    rateSheetRef: r.rate_sheet_ref,
    discountPctApplied: num(r.discount_pct_applied),
    escalationPctApplied: num(r.escalation_pct_applied),
    contingencyKind: r.contingency_kind,
    rationale: r.rationale,
    supportingDocumentId: r.supporting_document_id,
    notes: r.notes,
    req5Item: req5 ?? null,
  };
}
