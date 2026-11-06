import { describe, expect, it } from "vitest";
import { rowToLineItem } from "./mapping";
import type { LineItemRow } from "./types";

const row = (over: Partial<LineItemRow> = {}): LineItemRow => ({
  id: "x", workstream_id: "w", form_ref: "001-A", form_row_key: "001-A:concrete_demolition", cost_category: "demolition",
  task: "Pad", calc_mode: "qty_x_rate", quantity: "20.0000", unit: "t", unit_rate: 150, total: "3000.00",
  rate_sheet_id: null, rate_sheet_ref: null, discount_pct_applied: null, escalation_pct_applied: null,
  contingency_kind: null, rationale: null, supporting_document_id: null, notes: null, req5_item: null,
  sort_order: 0, created_at: "2026-11-05T00:00:00Z", ...over,
});

describe("rowToLineItem", () => {
  it("converts numeric strings and numbers", () => {
    const li = rowToLineItem(row());
    expect(li.quantity).toBe(20);
    expect(li.unitRate).toBe(150);
    expect(li.total).toBe(3000);
    expect(li.formRowKey).toBe("001-A:concrete_demolition");
  });
  it("keeps nulls as null (not zero)", () => {
    const li = rowToLineItem(row({ quantity: null, unit_rate: null, discount_pct_applied: null }));
    expect(li.quantity).toBeNull();
    expect(li.unitRate).toBeNull();
    expect(li.discountPctApplied).toBeNull();
  });
  it("treats unparseable numbers as null", () => {
    expect(rowToLineItem(row({ quantity: "abc" })).quantity).toBeNull();
  });
  it("accepts only valid Req. 5 item letters", () => {
    expect(rowToLineItem(row({ req5_item: "c" })).req5Item).toBe("c");
    expect(rowToLineItem(row({ req5_item: "z" })).req5Item).toBeNull();
    expect(rowToLineItem(row({ req5_item: null })).req5Item).toBeNull();
  });
  it("copes with an empty task", () => {
    expect(rowToLineItem(row({ task: null as unknown as string })).task).toBe("");
  });
});
