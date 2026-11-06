/**
 * Evaluator for the small formula language used by the AER cost-estimate workbook:
 * numbers, cell references, + - * /, parentheses, unary +/-, and SUM over ranges or lists.
 * Used to store cached results in the exported workbook (so viewers that don't recalculate still
 * show numbers) and to check the exported totals against the app's own arithmetic.
 */

const TOKEN = /\s*(\d+\.?\d*|[A-Z]{1,3}\d+|SUM\(|[-+*/(),:])/y;

type Tok = { t: "num" | "ref" | "sum" | "op"; v: string };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  TOKEN.lastIndex = 0;
  let pos = 0;
  while (pos < src.length) {
    if (/^\s*$/.test(src.slice(pos))) break;
    TOKEN.lastIndex = pos;
    const m = TOKEN.exec(src);
    if (!m) throw new Error(`Unsupported formula syntax at "${src.slice(pos)}" in "${src}"`);
    const v = m[1]!;
    out.push({ t: /^\d/.test(v) ? "num" : v === "SUM(" ? "sum" : /^[A-Z]/.test(v) ? "ref" : "op", v });
    pos = TOKEN.lastIndex;
  }
  return out;
}

const colNum = (c: string) => [...c].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
const colName = (n: number) => {
  let s = "";
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  return s;
};

function expandRange(a: string, b: string): string[] {
  const [, c1, r1] = /^([A-Z]+)(\d+)$/.exec(a)!;
  const [, c2, r2] = /^([A-Z]+)(\d+)$/.exec(b)!;
  const out: string[] = [];
  for (let c = colNum(c1!); c <= colNum(c2!); c++) for (let r = Number(r1); r <= Number(r2); r++) out.push(`${colName(c)}${r}`);
  return out;
}

/** Evaluate `formula` (without the leading "="); `cell(addr)` returns a referenced cell's numeric value. */
export function evalFormula(formula: string, cell: (addr: string) => number): number {
  const toks = tokenize(formula);
  let i = 0;
  const peek = () => toks[i];
  const next = () => toks[i++];
  const isOp = (v: string) => peek()?.t === "op" && peek()!.v === v;

  function expr(): number {
    let v = term();
    while (isOp("+") || isOp("-")) {
      const op = next()!.v;
      const r = term();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  }
  function term(): number {
    let v = factor();
    while (isOp("*") || isOp("/")) {
      const op = next()!.v;
      const r = factor();
      v = op === "*" ? v * r : v / r;
    }
    return v;
  }
  function factor(): number {
    const tk = next();
    if (!tk) throw new Error(`Unexpected end of formula "${formula}"`);
    if (tk.t === "op" && tk.v === "+") return factor();
    if (tk.t === "op" && tk.v === "-") return -factor();
    if (tk.t === "op" && tk.v === "(") {
      const v = expr();
      if (!isOp(")")) throw new Error(`Missing ) in "${formula}"`);
      next();
      return v;
    }
    if (tk.t === "num") return Number(tk.v);
    if (tk.t === "ref") return cell(tk.v);
    if (tk.t === "sum") {
      let total = 0;
      for (;;) {
        total += sumArg();
        if (isOp(",")) {
          next();
          continue;
        }
        break;
      }
      if (!isOp(")")) throw new Error(`Missing ) after SUM in "${formula}"`);
      next();
      return total;
    }
    throw new Error(`Unexpected "${tk.v}" in "${formula}"`);
  }
  function sumArg(): number {
    if (peek()?.t === "ref" && toks[i + 1]?.v === ":") {
      const a = next()!.v;
      next();
      const b = next();
      if (!b || b.t !== "ref") throw new Error(`Bad range in "${formula}"`);
      return expandRange(a, b.v).reduce((s, addr) => s + cell(addr), 0);
    }
    return expr();
  }

  const result = expr();
  if (i < toks.length) throw new Error(`Unexpected "${toks[i]!.v}" in "${formula}"`);
  return result;
}
