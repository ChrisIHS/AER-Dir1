import { FORM_ROW_BY_KEY } from "@/lib/forms/templateMap";
import { issue, linesOf } from "../helpers";
import type { Rule } from "../types";
import { WORKSTREAM_KINDS } from "../types";

export const BALANCE_TOLERANCE = 0.1; // assumption (docs/PLAN.md section 8)
const SCRAP_VALUE_KEYS = [
  "001-A:ferrous_material_value",
  "001-A:nonferrous_material_value",
];

/**
 * V-24 (Form 001-A note): there should be a material balance between demolition and
 * transportation/disposal. Tonnes demolished vs tonnes disposed + scrapped; warns beyond 10%.
 * The form excludes suspension materials (catalyst, chemicals, sludges) from this balance.
 */
export const v24MaterialBalance: Rule = (ctx) => {
  let demolished = 0;
  let accounted = 0;
  for (const kind of WORKSTREAM_KINDS) {
    for (const li of linesOf(ctx, kind)) {
      if (li.formRef !== "001-A" || !li.formRowKey || li.quantity === null) continue;
      const row = FORM_ROW_BY_KEY.get(li.formRowKey);
      if (!row || row.qtyUnit !== "t") continue;
      if (row.block === "demolition_suspension_abandonment") demolished += li.quantity;
      else if (row.block === "transport_disposal" && (row.key.endsWith("__disposal_fee") || SCRAP_VALUE_KEYS.includes(row.key))) {
        accounted += li.quantity;
      }
    }
  }
  const big = Math.max(demolished, accounted);
  if (big === 0 || Math.abs(demolished - accounted) / big <= BALANCE_TOLERANCE) return [];
  return [
    issue("V-24", "warn", "Form 001-A note", "abandonment",
      `Demolition is ${demolished} t but disposal plus scrap is ${accounted} t. The form expects a material balance between them (excluding suspension materials).`),
  ];
};
