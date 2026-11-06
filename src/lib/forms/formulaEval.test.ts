import { describe, expect, it } from "vitest";
import { evalFormula } from "./formulaEval";

const sheet = (cells: Record<string, number>) => (addr: string) => cells[addr] ?? 0;

describe("evalFormula", () => {
  it.each([
    ["1+2*3", {}, 7],
    ["(1+2)*3", {}, 9],
    ["+B10*D10", { B10: 20, D10: 150 }, 3000],
    ["-A1+5", { A1: 2 }, 3],
    ["10/4", {}, 2.5],
    ["SUM(F8:F10)", { F8: 1, F9: 2, F10: 3, F11: 100 }, 6],
    ["SUM(F11,F28,F51)", { F11: 1, F28: 2, F51: 4, F62: 99 }, 7],
    ["SUM(F27:F46)-F52", { F27: 10, F28: 5, F46: 1, F52: 4 }, 12],
    ["+F50+F51-(F48+F49)", { F50: 100, F51: 50, F48: 20, F49: 5 }, 125],
    ["+F24+F53+F59+F61+F62", { F24: 1, F53: 2, F59: 3, F61: 4, F62: 5 }, 15],
    ["SUM(A1:B2)", { A1: 1, A2: 2, B1: 3, B2: 4 }, 10],
  ])("%s", (f, cells, want) => {
    expect(evalFormula(f, sheet(cells))).toBeCloseTo(want, 10);
  });

  it("rejects syntax it does not understand rather than guessing", () => {
    expect(() => evalFormula("IF(A1>1,2,3)", sheet({}))).toThrow(/Unsupported/);
    expect(() => evalFormula("1+", sheet({}))).toThrow();
    expect(() => evalFormula("(1+2", sheet({}))).toThrow(/Missing \)/);
  });
});
