import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { beforeAll, describe, expect, it } from "vitest";
import {
  FORM_ROWS,
  FORM_ROW_BY_KEY,
  FORM_SUBTOTALS,
  HEADER_ROWS,
  SHEET_NAMES,
  TEMPLATE_FILE,
  TEMPLATE_SHA256,
  type FormRef,
} from "./templateMap";

const templatePath = path.resolve(__dirname, "../../..", TEMPLATE_FILE);

/** Cell text, flattening ExcelJS rich-text values ({ richText: [{ text }] }). */
const plain = (v: unknown): string => {
  if (v && typeof v === "object" && "richText" in v) {
    return (v as { richText: { text: string }[] }).richText.map((r) => r.text).join("");
  }
  return String(v ?? "");
};

const clean = (v: unknown) =>
  plain(v)
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** True for `=+B{r}*D{r}`, including shared-formula children whose master is `=+B{r0}*D{r0}`. */
function isProductFormula(cell: ExcelJS.Cell, row: number): boolean {
  const v = cell.value as unknown;
  if (!v || typeof v !== "object") return false;
  const o = v as { formula?: string; sharedFormula?: string };
  if (typeof o.formula === "string") return o.formula.replace(/\s/g, "") === `+B${row}*D${row}`;
  return typeof o.sharedFormula === "string";
}

const isFormula = (cell: ExcelJS.Cell) => {
  const v = cell.value as unknown;
  return !!v && typeof v === "object" && ("formula" in (v as object) || "sharedFormula" in (v as object));
};

describe("AER cost-estimate template mapping", () => {
  const wb = new ExcelJS.Workbook();

  beforeAll(async () => {
    await wb.xlsx.readFile(templatePath);
  });

  it("template file is exactly the version the map was generated from", () => {
    const sha = createHash("sha256").update(readFileSync(templatePath)).digest("hex");
    expect(sha, "AER template changed: re-map src/lib/forms/templateMap.ts and update TEMPLATE_SHA256").toBe(
      TEMPLATE_SHA256,
    );
  });

  it("keys are unique and prefixed with their form", () => {
    const keys = FORM_ROWS.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const r of FORM_ROWS) expect(r.key.startsWith(`${r.form}:`)).toBe(true);
  });

  for (const form of ["001-A", "001-B"] as FormRef[]) {
    describe(`Form ${form}`, () => {
      const sheet = () => wb.getWorksheet(SHEET_NAMES[form])!;

      it("sheet exists", () => {
        expect(sheet()).toBeTruthy();
      });

      it("header rows hold the five site fields", () => {
        const s = sheet();
        expect(clean(s.getCell(HEADER_ROWS.licenceNumber, 1).value)).toMatch(/Licence or Approval Number/);
        expect(clean(s.getCell(HEADER_ROWS.licenceType, 1).value)).toMatch(/Licence Type/);
        expect(clean(s.getCell(HEADER_ROWS.legalLandDescription, 1).value)).toMatch(/Legal Land Description/);
        expect(clean(s.getCell(HEADER_ROWS.licenseeNameBaId, 1).value)).toMatch(/Licensee or Approval Holder/);
        expect(clean(s.getCell(HEADER_ROWS.siteName, 1).value)).toMatch(/Site Name/);
      });

      it("every mapped row has the expected label and cell types", () => {
        const s = sheet();
        for (const r of FORM_ROWS.filter((x) => x.form === form)) {
          expect(clean(s.getCell(r.row, 1).value), `${r.key} label`).toBe(r.label);
          // inputs must be empty in the blank template
          expect(s.getCell(r.row, 2).value ?? null, `${r.key} col B`).toBeNull();
          expect(s.getCell(r.row, 4).value ?? null, `${r.key} col D`).toBeNull();
          if (r.kind === "qty_rate") {
            expect(isProductFormula(s.getCell(r.row, 6), r.row), `${r.key} col F is =B*D`).toBe(true);
            expect(clean(s.getCell(r.row, 3).value) || null, `${r.key} qty unit`).toBe(r.qtyUnit);
            expect(clean(s.getCell(r.row, 5).value) || null, `${r.key} rate unit`).toBe(r.rateUnit);
          } else {
            // direct rows: the amount is typed into col F, so F must NOT be a formula
            expect(isFormula(s.getCell(r.row, 6)), `${r.key} col F is an input`).toBe(false);
          }
        }
      });

      it("covers every =B*D row on the sheet (nothing silently unmappable)", () => {
        const s = sheet();
        const mapped = new Set(FORM_ROWS.filter((x) => x.form === form).map((x) => x.row));
        const missing: number[] = [];
        s.eachRow((row, n) => {
          if (n >= 8 && isProductFormula(row.getCell(6), n) && !mapped.has(n)) missing.push(n);
        });
        expect(missing, "rows with a =B*D formula but no mapping").toEqual([]);
      });

      it("subtotal and total rows are formulas, never written to", () => {
        const s = sheet();
        for (const st of FORM_SUBTOTALS.filter((x) => x.form === form)) {
          expect(isFormula(s.getCell(st.row, 6)), `row ${st.row} is a formula`).toBe(true);
        }
        const mapped = new Set(FORM_ROWS.filter((x) => x.form === form).map((x) => x.row));
        for (const st of FORM_SUBTOTALS.filter((x) => x.form === form)) {
          expect(mapped.has(st.row), `subtotal row ${st.row} must not be a line-item row`).toBe(false);
        }
      });
    });
  }

  it("lookup by key works", () => {
    expect(FORM_ROW_BY_KEY.get("001-A:concrete_demolition")?.row).toBe(10);
    expect(FORM_ROW_BY_KEY.get("001-B:decompaction")?.row).toBe(54);
  });
});
