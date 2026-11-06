import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { summarizeCosts } from "@/lib/costs";
import { goodContext, line } from "@/lib/validation/fixtures";
import { WORKSTREAM_KINDS } from "@/lib/validation/types";
import { buildSchedule } from "./schedule";

function input() {
  const ctx = goodContext();
  return {
    ctx,
    inp: {
      siteName: "Demo 6-12 Oil Well",
      licenceNumber: "DEMO-W-0001",
      lines: Object.fromEntries(WORKSTREAM_KINDS.map((k) => [k, ctx.workstreams[k].lineItems])) as never,
      rateSheets: [{ id: "rs1", title: "Acme Services 2026 rates", vendor: "Acme", effectiveDate: "2026-06-01", discountType: "none" }],
      documents: [{ id: "doc-scrap", title: "Recycler price list" }],
    },
  };
}
async function load(buf: Buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  return wb;
}

describe("itemized cost schedule", () => {
  it("lists every line and ends with a total equal to the app's cost summary", async () => {
    const { ctx, inp } = input();
    const { buffer, grandCents } = await buildSchedule(inp);
    expect(grandCents).toBe(summarizeCosts(ctx).grand);
    const ws = (await load(buffer)).getWorksheet("Itemized costs")!;
    const last = ws.getRow(ws.rowCount);
    expect(String(last.getCell(1).value)).toMatch(/^TOTAL/);
    expect(last.getCell(9).value).toBe(grandCents / 100);
  });

  it("shows the scrap-metal credit as a negative amount in the estimate column", async () => {
    const { inp } = input();
    const ws = (await load((await buildSchedule(inp)).buffer)).getWorksheet("Itemized costs")!;
    let found = false;
    ws.eachRow((r) => {
      if (r.getCell(4).value === "Ferrous scrap value") {
        found = true;
        expect(r.getCell(8).value).toBe(1000);
        expect(r.getCell(9).value).toBe(-1000);
        expect(r.getCell(14).value).toBe("Recycler price list");
      }
    });
    expect(found).toBe(true);
  });

  it("keeps each contingency on its own line with its type and rationale", async () => {
    const { ctx, inp } = input();
    ctx.workstreams.contingencies.lineItems.push(
      line({ costCategory: "contingency", contingencyKind: "restricted_access", rationale: "Live pipeline corridor not accessible", unitRate: 7000 }),
    );
    const ws = (await load((await buildSchedule(inp)).buffer)).getWorksheet("Itemized costs")!;
    const kinds: string[] = [];
    ws.eachRow((r) => { if (r.getCell(12).value && r.getCell(12).value !== "Contingency type") kinds.push(String(r.getCell(12).value)); });
    expect(kinds).toEqual(["General (Req. 5(k))", "Restricted access (Req. 34(a))"]);
  });

  it("subtotals each workstream and names the rate sheet with its date", async () => {
    const { inp } = input();
    const ws = (await load((await buildSchedule(inp)).buffer)).getWorksheet("Itemized costs")!;
    const subtotals: Record<string, unknown> = {};
    ws.eachRow((r) => {
      const a = String(r.getCell(1).value ?? "");
      if (a.startsWith("Subtotal: ")) subtotals[a] = r.getCell(9).value;
    });
    expect(subtotals["Subtotal: Reasonable care, measures and site security"]).toBe(61200);
    expect(subtotals["Subtotal: Suspension"]).toBe(5000);
    const second = ws.getRow(5);
    expect(String(second.getCell(10).value)).toBe("Acme Services 2026 rates (2026-06-01)");
  });

  it("includes a rate sheet register", async () => {
    const { inp } = input();
    const rs = (await load((await buildSchedule(inp)).buffer)).getWorksheet("Rate sheets")!;
    expect(rs.getRow(2).getCell(1).value).toBe("Acme Services 2026 rates");
    expect(rs.getRow(2).getCell(4).value).toBe("none");
  });
});
