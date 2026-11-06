import ExcelJS from "exceljs";
import { toCents } from "@/lib/money";
import type { LineItem } from "@/lib/validation/types";
import { evalFormula } from "./formulaEval";
import { FORM_ROW_BY_KEY, HEADER_ROWS, SHEET_NAMES, type FormRef } from "./templateMap";

export interface SiteHeader {
  licenceNumber: string;
  licenceType: string; // Well | Facility | Pipeline | Waste Management
  legalLandDescription: string;
  licenseeNameBaId: string;
  siteName: string;
}

export interface RowAgg {
  key: string;
  /** Value for column B (or null for direct rows). */
  qty: number | null;
  /** Value for column D (or null for direct rows). */
  rate: number | null;
  /** Amount for column F on direct rows; also the row total in dollars for every row. */
  total: number;
}

export interface CostFormTotals {
  /** Form 001-A: Total Reasonable Care and Measures, Suspension, and Abandonment Costs. */
  form001A: number;
  /** Form 001-B: Total Remediation and Reclamation Cost. */
  form001B: number;
  /** Form 001-B reclamation subtotal. */
  reclamation: number;
}

const r6 = (n: number) => Math.round(n * 1e6) / 1e6;
const r10 = (n: number) => Math.round(n * 1e10) / 1e10;

/**
 * Collapse line items onto the AER form's fixed rows. A row has one quantity and one unit cost, so
 * several lines on a row are combined so that column F (= B x D) equals their exact total:
 *  - same unit rate on every line  -> B = sum of quantities, D = that rate
 *  - different rates               -> B = sum of quantities, D = the weighted-average rate
 *  - percent rows (project management, contingency): B = percent and D = base only when every line is a
 *    percent line on the same base; otherwise B = 1 (100%) and D = the total
 *  - direct rows (the two suspension rows have no B or D): the total goes in column F.
 */
export function aggregateRows(lines: LineItem[]): Map<string, RowAgg> {
  const groups = new Map<string, LineItem[]>();
  for (const l of lines) {
    if (!l.formRowKey || !FORM_ROW_BY_KEY.has(l.formRowKey)) continue;
    groups.set(l.formRowKey, [...(groups.get(l.formRowKey) ?? []), l]);
  }
  const out = new Map<string, RowAgg>();
  for (const [key, ls] of groups) {
    const row = FORM_ROW_BY_KEY.get(key)!;
    const totalCents = ls.reduce((t, l) => t + toCents(l.total), 0);
    const total = totalCents / 100;
    if (row.kind === "direct") {
      if (totalCents !== 0) out.set(key, { key, qty: null, rate: null, total });
      continue;
    }
    if (row.percentBased) {
      const base = ls[0]!.unitRate;
      const samePercentBase = ls.every((l) => l.calcMode === "percent_of_base" && l.unitRate !== null && l.unitRate === base);
      if (samePercentBase && base !== null) {
        out.set(key, { key, qty: r6(ls.reduce((s, l) => s + (l.quantity ?? 0), 0)), rate: base, total });
      } else if (totalCents !== 0) {
        out.set(key, { key, qty: 1, rate: total, total });
      }
      continue;
    }
    const qty = ls.reduce((s, l) => s + (l.quantity ?? 0), 0);
    if (qty === 0) {
      if (totalCents !== 0) out.set(key, { key, qty: 1, rate: total, total });
      continue;
    }
    const first = ls[0]!.unitRate;
    const sameRate = first !== null && ls.every((l) => l.unitRate === first);
    const rate = sameRate && Math.round(qty * first * 100) === totalCents ? first : r10(total / qty);
    out.set(key, { key, qty: r6(qty), rate, total });
  }
  return out;
}

function numericValue(v: unknown): number {
  if (typeof v === "number") return v;
  if (v && typeof v === "object" && "result" in v && typeof (v as { result: unknown }).result === "number") {
    return (v as { result: number }).result;
  }
  return 0;
}

/**
 * Fill the AER cost-estimate workbook (reference/Directive001-Cost-Estimate-Forms.xlsx).
 * Only input cells are written (B, D, and F on the two direct rows, plus the header block);
 * every formula is kept, and its result is cached so viewers that don't recalculate still show numbers.
 */
export async function fillCostWorkbook(
  template: ArrayBuffer | Buffer,
  header: SiteHeader,
  lines: LineItem[],
): Promise<{ buffer: Buffer; totals: CostFormTotals }> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(template as ArrayBuffer);

  for (const form of ["001-A", "001-B"] as FormRef[]) {
    const ws = wb.getWorksheet(SHEET_NAMES[form])!;
    ws.getCell(HEADER_ROWS.licenceNumber, 2).value = header.licenceNumber;
    ws.getCell(HEADER_ROWS.licenceType, 2).value = header.licenceType;
    ws.getCell(HEADER_ROWS.legalLandDescription, 2).value = header.legalLandDescription;
    ws.getCell(HEADER_ROWS.licenseeNameBaId, 2).value = header.licenseeNameBaId;
    ws.getCell(HEADER_ROWS.siteName, 2).value = header.siteName;
  }

  for (const agg of aggregateRows(lines).values()) {
    const row = FORM_ROW_BY_KEY.get(agg.key)!;
    const ws = wb.getWorksheet(SHEET_NAMES[row.form])!;
    if (row.kind === "direct") {
      ws.getCell(row.row, 6).value = agg.total;
    } else {
      ws.getCell(row.row, 2).value = agg.qty;
      ws.getCell(row.row, 4).value = agg.rate;
    }
  }

  // Evaluate every formula (memoised), then store results. Collect first: rewriting a shared-formula
  // master would break its children's formulas mid-iteration.
  const formulas = new Map<string, { sheet: ExcelJS.Worksheet; addr: string; formula: string }>();
  for (const ws of wb.worksheets) {
    ws.eachRow((row) =>
      row.eachCell((cell) => {
        if (cell.formula) formulas.set(`${ws.name}!${cell.address}`, { sheet: ws, addr: cell.address, formula: cell.formula });
      }),
    );
  }
  const memo = new Map<string, number>();
  const valueOf = (ws: ExcelJS.Worksheet, addr: string, depth = 0): number => {
    if (depth > 50) throw new Error(`Formula loop at ${ws.name}!${addr}`);
    const id = `${ws.name}!${addr}`;
    if (memo.has(id)) return memo.get(id)!;
    const f = formulas.get(id);
    const v = f ? evalFormula(f.formula, (a) => valueOf(ws, a, depth + 1)) : numericValue(ws.getCell(addr).value);
    memo.set(id, v);
    return v;
  };
  for (const f of formulas.values()) {
    f.sheet.getCell(f.addr).value = { formula: f.formula, result: valueOf(f.sheet, f.addr) };
  }
  wb.calcProperties.fullCalcOnLoad = true;

  const a = wb.getWorksheet(SHEET_NAMES["001-A"])!;
  const b = wb.getWorksheet(SHEET_NAMES["001-B"])!;
  const totals: CostFormTotals = {
    form001A: valueOf(a, "F64"),
    form001B: valueOf(b, "F71"),
    reclamation: valueOf(b, "F62"),
  };
  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  return { buffer, totals };
}
