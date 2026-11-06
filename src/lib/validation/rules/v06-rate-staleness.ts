import { allLines, issue } from "../helpers";
import type { Issue, Rule } from "../types";

/** Assumption (docs/PLAN.md section 8): a rate sheet older than this is no longer "current-day". */
export const MAX_RATE_SHEET_AGE_MONTHS = 12;

/** V-06 (Req. 3): rates must be current-day. Warn when the rate sheet is undated or older than 12 months. */
export const v06RateStaleness: Rule = (ctx) => {
  const out: Issue[] = [];
  // Calendar-date comparison in UTC: a sheet dated exactly 12 months ago is still current.
  const cutoff = new Date(
    Date.UTC(ctx.now.getUTCFullYear(), ctx.now.getUTCMonth() - MAX_RATE_SHEET_AGE_MONTHS, ctx.now.getUTCDate()),
  );
  const sheets = new Map(ctx.rateSheets.map((r) => [r.id, r]));
  const seen = new Set<string>();
  for (const { kind, line } of allLines(ctx)) {
    const sheet = line.rateSheetId ? sheets.get(line.rateSheetId) : undefined;
    if (!sheet) continue;
    const key = `${sheet.id}:${kind}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (!sheet.effectiveDate) {
      out.push(issue("V-06", "warn", "Req. 3", kind, `Rate sheet "${sheet.title}" has no effective date, so its rates can't be shown to be current-day.`));
    } else if (new Date(sheet.effectiveDate) < cutoff) {
      out.push(
        issue("V-06", "warn", "Req. 3", kind,
          `Rate sheet "${sheet.title}" is dated ${sheet.effectiveDate}, more than ${MAX_RATE_SHEET_AGE_MONTHS} months old. Rates must be current-day.`),
      );
    }
  }
  return out;
};
