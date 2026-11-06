import { detailsSchemas, REQ_5_ITEMS, REQ_5_LABELS, REQ_47_ELEMENTS } from "./details";
import type { WorkstreamKind } from "@/lib/validation/types";
import { REQ_47_LABELS } from "@/lib/validation/rules/v21-reclamation-elements";

export type FieldType = "text" | "textarea" | "number" | "bool" | "select" | "segments" | "lines" | "multicheck" | "document";

export interface FieldSpec {
  /** Dotted path into the details object; also the form field name. */
  path: string;
  label: string;
  type: FieldType;
  req?: string;
  group?: string;
  options?: { value: string; label: string }[];
  hint?: string;
  /** Text only: remove the key when empty instead of storing null (used for record maps). */
  omitIfEmpty?: boolean;
}

const NPV: FieldSpec = {
  path: "attestations.noNpvDiscount",
  label: "I confirm no net present value, discounting or escalation was applied to this workstream.",
  type: "bool",
  req: "Req. 4",
};

export const DETAIL_FIELDS: Record<WorkstreamKind, FieldSpec[]> = {
  care_security: [NPV],
  suspension: [NPV],
  abandonment: [
    NPV,
    {
      path: "pipelineSegments",
      label: "Pipeline segments",
      type: "segments",
      req: "Req. 11",
      hint: "One segment per line: name | in_place or removed. Example: 6-12 to 11-12 (4.2 km) | removed",
    },
  ],
  reclamation: [
    NPV,
    {
      path: "elementsAddressed",
      label: "Elements the reclamation plan addresses",
      type: "multicheck",
      req: "Req. 47",
      options: REQ_47_ELEMENTS.map((e) => ({ value: e, label: `(${e}) ${REQ_47_LABELS[e]}` })),
    },
  ],
  contingencies: [
    NPV,
    { path: "missingHistoryDeclared", label: "Historical information is missing", type: "bool", req: "Req. 20, 49" },
    { path: "missingHistorySearchMethods", label: "Methods used to search for the missing information", type: "textarea", req: "Req. 49" },
    { path: "unevaluatedIssuesDeclared", label: "Some liability issues could not be sufficiently evaluated", type: "bool", req: "Req. 26, 49" },
  ],
  mgmt_admin: [
    NPV,
    ...REQ_5_ITEMS.filter((i) => i !== "k").map(
      (i): FieldSpec => ({
        path: `req5ZeroRationale.${i}`,
        label: `Why item (${i}) ${REQ_5_LABELS[i]} is zero (leave empty if costed)`,
        type: "text",
        req: `Req. 5(${i})`,
        group: "Zero-cost explanations",
        omitIfEmpty: true,
      }),
    ),
  ],
  esa_remediation: [
    NPV,
    { path: "phase1OnestopId", label: "Phase 1 ESA OneStop submission ID", type: "text", req: "Req. 17, 19, 58(d)", group: "OneStop references" },
    { path: "phase2OnestopId", label: "Phase 2 ESA OneStop submission ID", type: "text", req: "Req. 21, 58(d)", group: "OneStop references" },
    { path: "roscOnestopId", label: "Record of Site Condition OneStop submission ID", type: "text", req: "Req. 17, 58(d)", group: "OneStop references" },
    {
      path: "remediationApproach", label: "Remediation guideline approach", type: "select", req: "Req. 36, 37", group: "Approach",
      options: [{ value: "tier1", label: "Tier 1" }, { value: "tier2", label: "Tier 2" }],
    },
    { path: "tier2OnestopId", label: "Tier 2 assessment OneStop submission ID", type: "text", req: "Req. 37", group: "Approach" },
    { path: "apecs", label: "Areas of potential environmental concern (APECs)", type: "lines", req: "Req. 19, 21", group: "Approach", hint: "One APEC per line." },
    { path: "restrictedAccess.declared", label: "Safety concerns restricted the scope of the Phase 2 ESA", type: "bool", req: "Req. 34", group: "Restricted access" },
    { path: "restrictedAccess.rationale", label: "Rationale for the restricted scope", type: "textarea", req: "Req. 34(a)", group: "Restricted access" },
    { path: "volumes.affectedInSituM3", label: "Affected in-situ soil volume (m³)", type: "number", req: "Req. 27", group: "Volumes" },
    { path: "volumes.topsoilOverburdenM3", label: "Topsoil and overburden volume to handle (m³)", type: "number", req: "Req. 30", group: "Volumes" },
    { path: "volumes.plumeIrregularityFactor", label: "Plume irregularity factor", type: "number", req: "Req. 28", group: "Volumes" },
    { path: "volumes.plumeBasis", label: "Basis for the plume irregularity factor", type: "textarea", req: "Req. 28", group: "Volumes" },
    { path: "volumes.bulkingFactor", label: "Excavation-bulking factor (typically 1.2 to 1.4)", type: "number", req: "Req. 29", group: "Volumes" },
    { path: "volumes.bulkingBasis", label: "Basis for the bulking factor", type: "textarea", req: "Req. 29", group: "Volumes" },
    { path: "volumes.bulkingJustification", label: "Justification if the factor is outside 1.2 to 1.4", type: "textarea", req: "Req. 29", group: "Volumes" },
    { path: "offSiteDisposalPlanned", label: "Affected soil is disposed of off site", type: "bool", req: "Req. 39(b)", group: "Off-site disposal" },
    { path: "volumes.soilDensityTPerM3", label: "Soil density (t/m³)", type: "number", req: "Req. 32", group: "Off-site disposal" },
    { path: "volumes.moisturePct", label: "Moisture content (%)", type: "number", req: "Req. 32", group: "Off-site disposal" },
    { path: "volumes.densityMethod", label: "Method used to determine density and moisture", type: "textarea", req: "Req. 33", group: "Off-site disposal" },
    { path: "onSiteTreatment.planned", label: "Affected soil is treated on site", type: "bool", req: "Req. 39(b), 41", group: "On-site treatment" },
    { path: "onSiteTreatment.approach", label: "Approach and infrastructure needed", type: "textarea", req: "Req. 41(a)", group: "On-site treatment" },
    { path: "onSiteTreatment.siteSuitability", label: "Assessment of site suitability", type: "textarea", req: "Req. 41(b)", group: "On-site treatment" },
    { path: "onSiteTreatment.treatabilityResults", label: "Soil treatability test results", type: "textarea", req: "Req. 41(c)", group: "On-site treatment" },
    { path: "onSiteTreatment.volumeM3", label: "Volume requiring treatment (m³)", type: "number", req: "Req. 41(d)", group: "On-site treatment" },
    { path: "onSiteTreatment.durationRationale", label: "Rationale for predicted treatment duration", type: "textarea", req: "Req. 41(d)", group: "On-site treatment" },
    { path: "onSiteSystem.planned", label: "An on-site remediation system is proposed", type: "bool", req: "Req. 45", group: "On-site remediation system" },
    { path: "onSiteSystem.systemType", label: "Type of system (bio-cell, drainage tile, wells...)", type: "text", req: "Req. 45(a)", group: "On-site remediation system" },
    { path: "onSiteSystem.dimensions", label: "Dimensions (trench length, number and depth of wells...)", type: "text", req: "Req. 45(b)", group: "On-site remediation system" },
    { path: "onSiteSystem.durationYears", label: "Predicted operating duration (years)", type: "number", req: "Req. 45(d)", group: "On-site remediation system" },
    { path: "onSiteSystem.omCostsIncluded", label: "Operation, maintenance and water disposal costs cover the full duration", type: "bool", req: "Req. 45(e)-(f)", group: "On-site remediation system" },
    { path: "onSiteSystem.abandonmentCostsIncluded", label: "System abandonment costs are included", type: "bool", req: "Req. 45(g)", group: "On-site remediation system" },
    { path: "groundwater.planned", label: "Groundwater remediation is proposed", type: "bool", req: "Req. 42", group: "Groundwater" },
    { path: "groundwater.contaminationApparent", label: "Contamination of the uppermost aquifer is apparent", type: "bool", req: "Req. 24", group: "Groundwater" },
    { path: "groundwater.lowerAquiferAssessed", label: "The next lower water-bearing zone was assessed", type: "bool", req: "Req. 24", group: "Groundwater" },
    { path: "groundwater.sourceRemoval", label: "Contaminant source removal", type: "textarea", req: "Req. 42(a)", group: "Groundwater" },
    { path: "groundwater.approach", label: "Remediation approach", type: "textarea", req: "Req. 42(b)", group: "Groundwater" },
    { path: "groundwater.durationBasis", label: "Basis for treatment or monitoring duration", type: "textarea", req: "Req. 42(c)", group: "Groundwater" },
    { path: "groundwater.totalVolumeM3", label: "Estimated total volume of affected groundwater (m³)", type: "number", req: "Req. 42(d)", group: "Groundwater" },
    { path: "inPlaceRemediation.planned", label: "Contamination that cannot be excavated is remediated in place", type: "bool", req: "Req. 40", group: "In-place remediation" },
    { path: "inPlaceRemediation.durationYears", label: "Time to remediate in place (years)", type: "number", req: "Req. 40", group: "In-place remediation" },
    { path: "inPlaceRemediation.supportingDocumentId", label: "Supporting document", type: "document", req: "Req. 40", group: "In-place remediation" },
  ],
};

// ------------------------------------------------------------------ path helpers
export function getAt(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const key of path.split(".")) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

/** Set a dotted path, creating objects as needed. `undefined` deletes the key. */
export function setAt(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split(".");
  let cur = obj;
  for (const key of keys.slice(0, -1)) {
    const next = cur[key];
    if (next === null || typeof next !== "object" || Array.isArray(next)) cur[key] = {};
    cur = cur[key] as Record<string, unknown>;
  }
  const last = keys[keys.length - 1]!;
  if (value === undefined) delete cur[last];
  else cur[last] = value;
}

// ------------------------------------------------------------------ list <-> text
export type Segment = { id: string; label: string | null; method: "in_place" | "removed" | null };

export function textToSegments(text: string): Segment[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line, i) => {
      const [label, method] = line.split("|").map((p) => p.trim());
      return {
        id: `seg-${i + 1}`,
        label: label || null,
        method: method === "in_place" || method === "removed" ? method : null,
      };
    });
}

export const segmentsToText = (segs: Segment[]): string =>
  segs.map((s) => `${s.label ?? s.id} | ${s.method ?? ""}`.trimEnd()).join("\n");

export function textToApecs(text: string): { id: string; description: string | null }[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((description, i) => ({ id: `apec-${i + 1}`, description }));
}

export const apecsToText = (apecs: { description: string | null; id: string }[]): string =>
  apecs.map((a) => a.description ?? a.id).join("\n");

// ------------------------------------------------------------------ form -> details
const clean = (v: FormDataEntryValue | null): string => (typeof v === "string" ? v.trim() : "");

/**
 * Apply submitted form values on top of the stored details and validate with the Zod schema.
 * Returns the parsed details, or an error message (stored data is never replaced by defaults).
 */
export function readDetailsForm(
  fd: FormData,
  kind: WorkstreamKind,
  existing: unknown,
): { ok: true; data: Record<string, unknown> } | { ok: false; error: string } {
  const obj: Record<string, unknown> =
    existing && typeof existing === "object" ? (JSON.parse(JSON.stringify(existing)) as Record<string, unknown>) : {};

  for (const spec of DETAIL_FIELDS[kind]) {
    const name = spec.path;
    switch (spec.type) {
      case "bool":
        setAt(obj, name, fd.get(name) === "on");
        break;
      case "number": {
        const raw = clean(fd.get(name));
        const n = raw === "" ? null : Number(raw);
        setAt(obj, name, n !== null && Number.isFinite(n) ? n : null);
        break;
      }
      case "segments":
        setAt(obj, name, textToSegments(clean(fd.get(name))));
        break;
      case "lines":
        setAt(obj, name, textToApecs(clean(fd.get(name))));
        break;
      case "multicheck": {
        const allowed = new Set((spec.options ?? []).map((o) => o.value));
        setAt(obj, name, fd.getAll(name).filter((v): v is string => typeof v === "string" && allowed.has(v)));
        break;
      }
      default: {
        const raw = clean(fd.get(name));
        setAt(obj, name, raw === "" ? (spec.omitIfEmpty ? undefined : null) : raw);
      }
    }
  }

  const parsed = detailsSchemas[kind].safeParse(obj);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: `Invalid value${first ? ` at ${first.path.join(".")}: ${first.message}` : ""}` };
  }
  return { ok: true, data: parsed.data as Record<string, unknown> };
}
