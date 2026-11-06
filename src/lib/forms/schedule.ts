import ExcelJS from "exceljs";
import { signedCents } from "@/lib/costs";
import { FORM_ROW_BY_KEY } from "@/lib/forms/templateMap";
import { toCents } from "@/lib/money";
import type { LineItem, WorkstreamKind } from "@/lib/validation/types";
import { WORKSTREAM_KINDS } from "@/lib/validation/types";
import { CONTINGENCY_LABEL } from "@/lib/workstreams/labels";
import { WORKSTREAM_META } from "@/lib/workstreams/meta";

export interface ScheduleInput {
  siteName: string;
  licenceNumber: string;
  lines: Record<WorkstreamKind, LineItem[]>;
  rateSheets: { id: string; title: string; vendor: string | null; effectiveDate: string | null; discountType: string }[];
  documents: { id: string; title: string }[];
}

const CAD = '"$"#,##0.00;[Red]-"$"#,##0.00';

/**
 * The itemized cost schedule (Req. 2(c), 58(h)): every line with its rate source and page, grouped by
 * workstream with subtotals. Contingencies appear as separate lines here even though the AER forms
 * have a single contingency row (Req. 34(a), 49).
 */
export async function buildSchedule(input: ScheduleInput): Promise<{ buffer: Buffer; grandCents: number }> {
  const sheets = new Map(input.rateSheets.map((r) => [r.id, r]));
  const docs = new Map(input.documents.map((d) => [d.id, d.title]));
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Itemized costs", { views: [{ state: "frozen", ySplit: 4 }] });

  ws.addRow([`Itemized cost schedule: ${input.siteName}`]).font = { bold: true, size: 14 };
  ws.addRow([`AER licence or approval number: ${input.licenceNumber}`]);
  ws.addRow(["Undiscounted, current-day, third-party rates (Req. 3, 4). A credit (scrap-metal value, Req. 12) is shown as a negative amount."]);
  const head = ws.addRow([
    "Workstream", "AER form", "Form row", "Task", "Quantity", "Unit", "Unit rate", "Line total", "In estimate",
    "Rate sheet", "Page / line", "Contingency type", "Rationale", "Supporting document", "Notes",
  ]);
  head.font = { bold: true };
  head.alignment = { wrapText: true, vertical: "top" };

  let grand = 0;
  for (const kind of WORKSTREAM_KINDS) {
    const lines = input.lines[kind];
    if (lines.length === 0) continue;
    let sub = 0;
    for (const l of lines) {
      const signed = signedCents(l);
      sub += signed;
      const row = l.formRowKey ? FORM_ROW_BY_KEY.get(l.formRowKey) : undefined;
      const sheet = l.rateSheetId ? sheets.get(l.rateSheetId) : undefined;
      const r = ws.addRow([
        WORKSTREAM_META[kind].title,
        l.formRef,
        row?.label ?? "(no form row)",
        l.task,
        l.quantity ?? "",
        l.calcMode === "percent_of_base" ? "% of base" : (l.unit ?? ""),
        l.unitRate ?? "",
        toCents(l.total) / 100,
        signed / 100,
        sheet ? `${sheet.title}${sheet.effectiveDate ? ` (${sheet.effectiveDate})` : ""}` : "",
        l.rateSheetRef ?? "",
        l.contingencyKind ? CONTINGENCY_LABEL[l.contingencyKind] : "",
        l.rationale ?? "",
        l.supportingDocumentId ? (docs.get(l.supportingDocumentId) ?? "") : "",
        l.notes ?? "",
      ]);
      r.getCell(7).numFmt = CAD;
      r.getCell(8).numFmt = CAD;
      r.getCell(9).numFmt = CAD;
    }
    const subRow = ws.addRow([`Subtotal: ${WORKSTREAM_META[kind].title}`, "", "", "", "", "", "", "", sub / 100]);
    subRow.font = { bold: true };
    subRow.getCell(9).numFmt = CAD;
    grand += sub;
  }
  const total = ws.addRow(["TOTAL (all workstreams, Forms 001-A and 001-B)", "", "", "", "", "", "", "", grand / 100]);
  total.font = { bold: true };
  total.getCell(9).numFmt = CAD;

  const widths = [34, 9, 36, 38, 10, 10, 12, 14, 14, 34, 14, 22, 40, 26, 30];
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));

  const rs = wb.addWorksheet("Rate sheets");
  rs.addRow(["Title", "Vendor / publisher", "Effective date", "Discounts in these rates"]).font = { bold: true };
  for (const r of input.rateSheets) rs.addRow([r.title, r.vendor ?? "", r.effectiveDate ?? "", r.discountType.replace(/_/g, " ")]);
  [40, 30, 16, 30].forEach((w, i) => (rs.getColumn(i + 1).width = w));

  return { buffer: Buffer.from(await wb.xlsx.writeBuffer()), grandCents: grand };
}
