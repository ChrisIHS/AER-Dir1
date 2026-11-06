import { readFileSync } from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { summarizeCosts } from "@/lib/costs";
import { allLines } from "@/lib/validation/helpers";
import { goodContext, line } from "@/lib/validation/fixtures";
import { aggregateRows, fillCostWorkbook, type SiteHeader } from "./costForms";
import { TEMPLATE_FILE } from "./templateMap";

const template = readFileSync(path.resolve(__dirname, "../../..", TEMPLATE_FILE));
const header: SiteHeader = {
  licenceNumber: "DEMO-W-0001",
  licenceType: "Well",
  legalLandDescription: "00/06-12-045-08W5/0",
  licenseeNameBaId: "Prairie Ridge Energy Ltd. (DEMO-BA-0001)",
  siteName: "Demo 6-12 Oil Well",
};

async function filled(lines = allLines(goodContext()).map((x) => x.line)) {
  const out = await fillCostWorkbook(template, header, lines);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(out.buffer as unknown as ArrayBuffer);
  return { ...out, a: wb.getWorksheet("Form 001-A")!, b: wb.getWorksheet("Form 001-B")!, wb };
}
const result = (ws: ExcelJS.Worksheet, addr: string) => (ws.getCell(addr).value as { result: number }).result;

describe("aggregateRows", () => {
  const row = (over: Parameters<typeof line>[0]) => line({ formRowKey: "001-A:concrete_demolition", ...over });

  it("keeps the original rate when every line shares it", () => {
    const m = aggregateRows([row({ quantity: 10, unitRate: 100 }), row({ quantity: 5, unitRate: 100 })]);
    expect(m.get("001-A:concrete_demolition")).toMatchObject({ qty: 15, rate: 100, total: 1500 });
  });

  it("uses the weighted-average rate when rates differ, so B x D equals the exact total", () => {
    const r = aggregateRows([row({ quantity: 10, unitRate: 100 }), row({ quantity: 5, unitRate: 130 })]).get("001-A:concrete_demolition")!;
    expect(r.qty).toBe(15);
    expect(r.rate).toBeCloseTo(110, 9);
    expect(r.qty! * r.rate!).toBeCloseTo(1650, 6);
  });

  it("handles repeating decimals without drifting from the total", () => {
    const r = aggregateRows([row({ quantity: 3, unitRate: 100 }), row({ quantity: 4, unitRate: 101 })]).get("001-A:concrete_demolition")!;
    expect(Math.round(r.qty! * r.rate! * 100)).toBe(70400);
  });

  it("puts direct rows in column F only", () => {
    const m = aggregateRows([line({ formRowKey: "001-A:facility_suspension_purge_vessels_flow_lines", unitRate: 5000 })]);
    expect(m.get("001-A:facility_suspension_purge_vessels_flow_lines")).toEqual({
      key: "001-A:facility_suspension_purge_vessels_flow_lines", qty: null, rate: null, total: 5000,
    });
  });

  it("percent rows: B = percent and D = base when every line is a percent line on one base", () => {
    const l = (q: number) => line({ formRowKey: "001-A:contingency", calcMode: "percent_of_base", quantity: q, unitRate: 100000 });
    expect(aggregateRows([l(0.05), l(0.05)]).get("001-A:contingency")).toMatchObject({ qty: 0.1, rate: 100000, total: 10000 });
  });

  it("percent rows with lump-sum lines fall back to 100% x total", () => {
    const m = aggregateRows([line({ formRowKey: "001-A:contingency", quantity: 1, unitRate: 2500 })]);
    expect(m.get("001-A:contingency")).toMatchObject({ qty: 1, rate: 2500, total: 2500 });
  });

  it("ignores lines with no or an unknown form row, and empty zero lines", () => {
    const m = aggregateRows([line({ formRowKey: null }), line({ formRowKey: "no-such-row" }), row({ quantity: 0, unitRate: 0 })]);
    expect(m.size).toBe(0);
  });
});

describe("fillCostWorkbook on the known-good estimate", () => {
  it("writes the header block on both sheets", async () => {
    const { a, b } = await filled();
    for (const ws of [a, b]) {
      expect(ws.getCell("B2").value).toBe("DEMO-W-0001");
      expect(ws.getCell("B3").value).toBe("Well");
      expect(ws.getCell("B4").value).toBe("00/06-12-045-08W5/0");
      expect(ws.getCell("B5").value).toBe("Prairie Ridge Energy Ltd. (DEMO-BA-0001)");
      expect(ws.getCell("B6").value).toBe("Demo 6-12 Oil Well");
    }
  });

  it("writes quantity and unit cost to inputs and caches the formula result", async () => {
    const { a } = await filled();
    expect(a.getCell("B10").value).toBe(20);
    expect(a.getCell("D10").value).toBe(150);
    expect(result(a, "F10")).toBe(3000);
    expect(a.getCell("F10").formula).toBe("+B10*D10");
  });

  it("direct rows take the amount in column F", async () => {
    const { a } = await filled();
    expect(a.getCell("F8").value).toBe(5000);
  });

  it("scrap value is subtracted: disposal 1,200 - scrap 1,000 = 200", async () => {
    const { a } = await filled();
    expect(result(a, "F50")).toBe(1000);
    expect(result(a, "F52")).toBe(1000);
    expect(result(a, "F53")).toBe(200);
  });

  it("percent rows hold the percent and the base", async () => {
    const { a } = await filled();
    expect(a.getCell("B61").value).toBe(0.1);
    expect(a.getCell("D61").value).toBe(100000);
    expect(result(a, "F61")).toBe(10000);
  });

  it("lump-sum lines on a percent row show 100% of the total", async () => {
    const { a } = await filled();
    expect(a.getCell("B58").value).toBe(1);
    expect(a.getCell("D58").value).toBe(10000);
  });

  it("form totals equal the app's own cost summary to the cent", async () => {
    const ctx = goodContext();
    const { totals } = await filled(allLines(ctx).map((x) => x.line));
    const s = summarizeCosts(ctx);
    expect(Math.round(totals.form001A * 100)).toBe(s.byForm["001-A"]);
    expect(Math.round(totals.form001B * 100)).toBe(s.byForm["001-B"]);
  });

  it("form totals also match when lines share rows at different rates", async () => {
    const ctx = goodContext();
    ctx.workstreams.abandonment.lineItems.push(
      line({ costCategory: "demolition", formRowKey: "001-A:concrete_demolition", quantity: 7.5, unitRate: 133.33 }),
      line({ costCategory: "reclamation", formRef: "001-B", formRowKey: "001-B:topsoil_purchase_delivery_and_placement", quantity: 0.8, unitRate: 9123.45 }),
    );
    const lines = allLines(ctx).map((x) => x.line);
    const { totals } = await filled(lines);
    const s = summarizeCosts(ctx);
    expect(Math.round(totals.form001A * 100)).toBe(s.byForm["001-A"]);
    expect(Math.round(totals.form001B * 100)).toBe(s.byForm["001-B"]);
  });

  it("exposes the reclamation subtotal for the Liability Declaration", async () => {
    const { totals } = await filled();
    expect(totals.reclamation).toBe(10800);
  });

  it("keeps every formula of the template and writes no AER cell it should not", async () => {
    const t = new ExcelJS.Workbook();
    await t.xlsx.load(template as unknown as ArrayBuffer);
    const count = (wb: ExcelJS.Workbook) => {
      let n = 0;
      for (const ws of wb.worksheets) ws.eachRow((r) => r.eachCell((c) => { if (c.formula) n++; }));
      return n;
    };
    const { wb } = await filled();
    expect(count(wb)).toBe(count(t));
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Form 001-A", "Form 001-B"]);
  });

  it("is idempotent: filling the same lines twice gives identical cell values", async () => {
    const one = await filled();
    const two = await filled();
    expect(two.totals).toEqual(one.totals);
  });
});
