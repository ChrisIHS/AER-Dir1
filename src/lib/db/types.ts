import type { ContingencyKind, CostCategory, DiscountType, DocumentKind, SiteType, WorkstreamKind } from "@/lib/validation/types";
import type { WorkstreamStatus } from "@/lib/tracker/tracker";

/** Row shapes as returned by PostgREST (snake_case). Hand-written; replace with generated types later. */
export interface SiteRow {
  id: string;
  licensee_org_id: string;
  site_type: SiteType;
  is_landfill: boolean;
  licence_no: string | null;
  lsd: string | null;
  site_name: string | null;
  facility_type: string | null;
}

export interface OrgRow {
  id: string;
  name: string;
  kind: "licensee" | "contractor" | "assessor_firm";
  ba_id: string | null;
}

export interface WorkstreamRow {
  id: string;
  assessment_id: string;
  kind: WorkstreamKind;
  applicable: boolean;
  na_rationale: string | null;
  status: WorkstreamStatus;
}

export interface LineItemRow {
  id: string;
  workstream_id: string;
  form_ref: "001-A" | "001-B";
  form_row_key: string | null;
  cost_category: CostCategory;
  task: string;
  calc_mode: "qty_x_rate" | "percent_of_base";
  quantity: number | string | null;
  unit: string | null;
  unit_rate: number | string | null;
  total: number | string;
  rate_sheet_id: string | null;
  rate_sheet_ref: string | null;
  discount_pct_applied: number | string | null;
  escalation_pct_applied: number | string | null;
  contingency_kind: ContingencyKind | null;
  rationale: string | null;
  supporting_document_id: string | null;
  notes: string | null;
  req5_item: string | null;
  sort_order: number;
  created_at: string;
}

export interface RateSheetRow {
  id: string;
  site_id: string;
  uploaded_by_org: string;
  vendor: string | null;
  title: string;
  effective_date: string | null;
  storage_path: string;
  discount_type: DiscountType;
  shared: boolean;
  created_at: string;
}

export interface DocumentRow {
  id: string;
  site_id: string;
  workstream_id: string | null;
  uploaded_by_org: string;
  kind: DocumentKind;
  title: string;
  storage_path: string;
  created_at: string;
}

export interface ManualStatus {
  liabilityDeclaration?: "none" | "generated" | "signed";
  costFormsGenerated?: boolean;
  supportingInfoNoneRequiredReason?: string | null;
  aerSystemUpdate?: { date: string; reference: string } | null;
}
