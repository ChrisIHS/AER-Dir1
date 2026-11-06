import { allLines, hasAmount, issue, linesOf, section5Applies } from "../helpers";
import type { Issue, Rule } from "../types";

const BACKFILL_ROWS = ["001-B:backfilling", "001-B:purchase_and_delivery", "001-B:placement_and_compaction"];
const TOPSOIL_ROW = "001-B:topsoil_purchase_delivery_and_placement";

/**
 * V-14 (Req. 43(c), 44): the cost of importing backfill to replace soil disposed of off site must be
 * separate from the cost of handling unaffected overburden and topsoil.
 */
export const v14BackfillSeparate: Rule = (ctx) => {
  if (!section5Applies(ctx)) return [];
  const out: Issue[] = [];
  const esaLines = linesOf(ctx, "esa_remediation");

  const offSite =
    ctx.details.esa_remediation.offSiteDisposalPlanned ||
    esaLines.some((li) => li.costCategory === "remediation_off_site" && hasAmount(li));
  const hasBackfill = esaLines.some((li) => li.costCategory === "backfill_import" && hasAmount(li));
  if (ctx.workstreams.esa_remediation.applicable && offSite && !hasBackfill) {
    out.push(
      issue("V-14", "block", "Req. 43(c), 44", "esa_remediation",
        "Soil is disposed of off site but no backfill-import cost is entered. Cost backfill purchase, delivery, placement and compaction as its own lines."),
    );
  }

  for (const { kind, line } of allLines(ctx)) {
    if (line.costCategory === "overburden_topsoil_handling" && line.formRowKey && BACKFILL_ROWS.includes(line.formRowKey)) {
      out.push(
        issue("V-14", "block", "Req. 44", kind,
          "Overburden/topsoil handling is entered on a backfill row. Keep backfill import separate from overburden and topsoil handling.",
          { lineItemId: line.id }),
      );
    }
    if (line.costCategory === "backfill_import" && line.formRowKey === TOPSOIL_ROW) {
      out.push(
        issue("V-14", "block", "Req. 44", kind,
          "Backfill import is entered on the topsoil row. Keep backfill import separate from overburden and topsoil handling.",
          { lineItemId: line.id }),
      );
    }
    if (/backfill/i.test(line.task) && /(topsoil|overburden)/i.test(line.task)) {
      out.push(
        issue("V-14", "warn", "Req. 44", kind,
          "One line mentions both backfill and topsoil/overburden. Split it into two lines.",
          { lineItemId: line.id }),
      );
    }
  }
  return out;
};
