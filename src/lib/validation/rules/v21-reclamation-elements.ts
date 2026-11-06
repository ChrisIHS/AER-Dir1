import { isApplicable, issue, section5Applies } from "../helpers";
import { REQ_47_ELEMENTS, type Req47Element } from "@/lib/workstreams/details";
import type { Rule } from "../types";

export const REQ_47_LABELS: Record<Req47Element, string> = {
  a: "maintaining the land; removing access road and related infrastructure",
  b: "removing gravel and surface materials, with volumes",
  c: "replacing subsoil and topsoil, with salvaged and imported volumes",
  d: "soil structure, sterilant and hydrophobicity issues",
  e: "recontouring and stabilizing slopes",
  f: "restoring surface drainage patterns",
  g: "planting, maintaining and monitoring vegetation",
  h: "preparing a detailed site assessment",
  i: "completing the reclamation certificate process",
  j: "administrative tasks to obtain a reclamation certificate",
};

/** V-21 (Req. 47): the reclamation plan addresses elements (a)-(j). Warn only. */
export const v21ReclamationElements: Rule = (ctx) => {
  if (!section5Applies(ctx) || !isApplicable(ctx, "reclamation")) return [];
  const done = new Set(ctx.details.reclamation.elementsAddressed);
  const missing = REQ_47_ELEMENTS.filter((e) => !done.has(e));
  if (missing.length === 0) return [];
  return [
    issue("V-21", "warn", "Req. 47", "reclamation",
      `The reclamation plan does not yet cover: ${missing.map((e) => `(${e}) ${REQ_47_LABELS[e]}`).join("; ")}.`,
      { field: "elementsAddressed" }),
  ];
};
