import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FORM_ROW_BY_KEY } from "./templateMap";

const ROOT = path.resolve(__dirname, "../../..");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|sql)$/.test(name)) out.push(p);
  }
  return out;
}

/** Guards against typos: every '001-A:xxx' / '001-B:xxx' literal in app code, tests and the seed must be a real template row. */
describe("form row keys referenced in the codebase", () => {
  const files = [...walk(path.join(ROOT, "src")), ...walk(path.join(ROOT, "supabase"))].filter((f) => !f.endsWith("templateMap.ts") && !f.endsWith("keysUsed.test.ts"));
  it("exist in templateMap", () => {
    const bad: string[] = [];
    for (const f of files) {
      const text = readFileSync(f, "utf8");
      for (const m of text.matchAll(/001-[AB]:[a-z0-9_]+/g)) {
        if (!FORM_ROW_BY_KEY.has(m[0])) bad.push(`${path.relative(ROOT, f)}: ${m[0]}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
