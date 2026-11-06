import type { DetailsByKind, Req5Item } from "@/lib/workstreams/details";

export const WORKSTREAM_KINDS = [
  "care_security",
  "suspension",
  "abandonment",
  "esa_remediation",
  "reclamation",
  "contingencies",
  "mgmt_admin",
] as const;
export type WorkstreamKind = (typeof WORKSTREAM_KINDS)[number];

export type SiteType = "well" | "facility" | "pipeline" | "owm_facility";
export type FormRef = "001-A" | "001-B";
export type ContingencyKind = "general" | "missing_history" | "unevaluated" | "restricted_access";
export type DiscountType = "none" | "available_to_all" | "client_specific" | "multi_site";

export type CostCategory =
  | "care"
  | "security"
  | "suspension"
  | "abandonment"
  | "demolition"
  | "hazardous_materials"
  | "transport_disposal"
  | "scrap_metal"
  | "esa"
  | "remediation_on_site"
  | "remediation_off_site"
  | "backfill_import"
  | "overburden_topsoil_handling"
  | "reclamation"
  | "project_management"
  | "contingency"
  | "salvage_resale"
  | "other";

export type DocumentKind =
  | "suspension_plan"
  | "discontinuation_plan"
  | "abandonment_plan"
  | "phase1_esa"
  | "phase2_esa"
  | "rosc"
  | "remediation_plan"
  | "reclamation_plan"
  | "site_drawing"
  | "scrap_support"
  | "supporting"
  | "signed_forms"
  | "remedial_action_plan"
  | "contamination_mgmt_report";

/** One row of `cost_line_items`. `total` is the database-generated amount in dollars. */
export interface LineItem {
  id: string;
  formRef: FormRef;
  formRowKey: string | null;
  costCategory: CostCategory;
  task: string;
  calcMode: "qty_x_rate" | "percent_of_base";
  quantity: number | null;
  unit: string | null;
  unitRate: number | null;
  total: number;
  rateSheetId: string | null;
  rateSheetRef: string | null;
  discountPctApplied: number | null;
  escalationPctApplied: number | null;
  contingencyKind: ContingencyKind | null;
  rationale: string | null;
  supportingDocumentId: string | null;
  notes: string | null;
  req5Item: Req5Item | null;
}

export interface RateSheet {
  id: string;
  title: string;
  effectiveDate: string | null; // ISO date
  discountType: DiscountType;
}

export interface DocumentRef {
  id: string;
  kind: DocumentKind;
  title: string;
  workstreamKind?: WorkstreamKind | null;
}

export interface WorkstreamState {
  applicable: boolean;
  naRationale: string | null;
  lineItems: LineItem[];
}

/** Everything the rules may look at. Built by the server from database rows; no I/O in rules. */
export interface ValidationContext {
  site: { siteType: SiteType; isLandfill: boolean };
  now: Date;
  workstreams: Record<WorkstreamKind, WorkstreamState>;
  details: DetailsByKind;
  rateSheets: RateSheet[];
  documents: DocumentRef[];
}

export type Severity = "block" | "warn" | "info";

export interface Issue {
  ruleId: string; // e.g. "V-07"
  severity: Severity;
  /** Directive 001 requirement reference shown to the user, e.g. "Req. 29". */
  req: string;
  message: string;
  /** Workstream whose submission this issue gates. */
  workstream: WorkstreamKind;
  lineItemId?: string;
  /** Dotted path into workstream details, for focusing the field in the UI. */
  field?: string;
}

export type Rule = (ctx: ValidationContext) => Issue[];
