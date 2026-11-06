import type { CostCategory, ContingencyKind } from "@/lib/validation/types";

export const DOC_KIND_LABEL: Record<string, string> = {
  suspension_plan: "Suspension plan (Req. 58(a))",
  discontinuation_plan: "Discontinuation plan, pipelines only (Req. 58(b))",
  abandonment_plan: "Abandonment plan (Req. 58(c))",
  phase1_esa: "Phase 1 ESA report",
  phase2_esa: "Phase 2 ESA report",
  rosc: "Record of Site Condition",
  remediation_plan: "Remediation plan (Req. 58(e))",
  reclamation_plan: "Reclamation plan (Req. 58(f))",
  site_drawing: "Site drawing with sample points and affected areas (Req. 31)",
  scrap_support: "Scrap-metal supporting information (Req. 12)",
  supporting: "Other supporting information (Req. 58(i))",
  signed_forms: "Stamped and signed report or statement pages (Req. 54, 55)",
};

/** Categories offered when entering a line. `salvage_resale` is deliberately absent (Req. 12). */
export const COST_CATEGORY_LABEL: Partial<Record<CostCategory, string>> = {
  care: "Reasonable care and measures",
  security: "Site security",
  suspension: "Suspension",
  abandonment: "Abandonment",
  demolition: "Demolition",
  hazardous_materials: "Hazardous materials",
  transport_disposal: "Transportation and disposal",
  scrap_metal: "Scrap metal (credit needs support, Req. 12)",
  esa: "Environmental site assessment",
  remediation_on_site: "Remediation: on site",
  remediation_off_site: "Remediation: off-site transport and disposal",
  backfill_import: "Backfill import (Req. 44)",
  overburden_topsoil_handling: "Overburden / topsoil handling (Req. 44)",
  reclamation: "Reclamation",
  project_management: "Project management / administration",
  contingency: "Contingency",
  other: "Other",
};

export const CONTINGENCY_LABEL: Record<ContingencyKind, string> = {
  general: "General (Req. 5(k))",
  missing_history: "Missing history (Req. 20, 49)",
  unevaluated: "Unevaluated issues (Req. 26, 49)",
  restricted_access: "Restricted access (Req. 34(a))",
};

export const BLOCK_TITLE: Record<string, string> = {
  demolition_suspension_abandonment: "Demolition, suspension and abandonment",
  transport_disposal: "Transportation and disposal",
  project_management: "Project management",
  contingency: "Contingency",
  care_and_security: "Care, measures and security (3 years)",
  esa: "Environmental site assessments",
  on_site_remediation: "On-site remediation",
  off_site_transport_disposal: "Off-site transportation and disposal",
  reclamation: "Reclamation",
};
