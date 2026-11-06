import { issue } from "../helpers";
import type { Rule } from "../types";

/** V-20 (Req. 14, 15): landfills only have to meet Req. 14 in section 5; section 5 rules are skipped for them. */
export const v20LandfillInfo: Rule = (ctx) =>
  ctx.site.isLandfill
    ? [
        issue("V-20", "info", "Req. 14, 15", "esa_remediation",
          "This site is an oilfield landfill. For remediation and reclamation only Req. 14 applies: costs must follow Directive 058 and the Standards for Landfills in Alberta."),
      ]
    : [];
