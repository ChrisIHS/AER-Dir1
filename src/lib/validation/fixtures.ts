import { parseDetails, REQ_5_ITEMS, REQ_47_ELEMENTS } from "@/lib/workstreams/details";
import type { LineItem, ValidationContext, WorkstreamState } from "./types";
import { WORKSTREAM_KINDS } from "./types";

/** Fixed "today" so date-based rules are deterministic in tests. */
export const NOW = new Date("2026-11-05T12:00:00Z");

let seq = 0;
/** Build a line item with sane defaults; `total` is derived like the database does (rounded to cents). */
export function line(over: Partial<LineItem> = {}): LineItem {
  seq += 1;
  const base: LineItem = {
    id: `li-${seq}`,
    formRef: "001-A",
    formRowKey: null,
    costCategory: "other",
    task: "Test task",
    calcMode: "qty_x_rate",
    quantity: 1,
    unit: "ls",
    unitRate: 100,
    total: 0,
    rateSheetId: "rs1",
    rateSheetRef: "p. 1",
    discountPctApplied: null,
    escalationPctApplied: null,
    contingencyKind: null,
    rationale: null,
    supportingDocumentId: null,
    notes: null,
    req5Item: null,
    ...over,
  };
  if (over.total === undefined) base.total = Math.round((base.quantity ?? 0) * (base.unitRate ?? 0) * 100) / 100;
  return base;
}

function emptyWorkstreams(): Record<(typeof WORKSTREAM_KINDS)[number], WorkstreamState> {
  return Object.fromEntries(
    WORKSTREAM_KINDS.map((k) => [k, { applicable: true, naRationale: null, lineItems: [] }]),
  ) as unknown as Record<(typeof WORKSTREAM_KINDS)[number], WorkstreamState>;
}

/**
 * A complete, valid well site (off-site disposal, Tier 1). Every rule must pass on it with zero
 * issues of any severity. Rule tests mutate a fresh copy per case.
 */
export function goodContext(): ValidationContext {
  const ws = emptyWorkstreams();

  ws.care_security.lineItems = [
    line({ costCategory: "care", task: "Reasonable care and measures", quantity: 3, unit: "year", unitRate: 12000,
           formRowKey: "001-A:additional_reasonable_care_and_measures_and_security_3_years" }),
    line({ costCategory: "security", task: "Site security", quantity: 36, unit: "month", unitRate: 700,
           formRowKey: "001-A:additional_reasonable_care_and_measures_and_security_3_years" }),
  ];
  ws.suspension.lineItems = [
    line({ costCategory: "suspension", task: "Purge flow lines", quantity: 1, unit: "ls", unitRate: 5000,
           formRowKey: "001-A:facility_suspension_purge_vessels_flow_lines" }),
  ];
  ws.abandonment.lineItems = [
    line({ costCategory: "demolition", task: "Concrete pad removal", quantity: 20, unit: "t", unitRate: 150,
           formRowKey: "001-A:concrete_demolition" }),
    line({ costCategory: "transport_disposal", task: "Class II landfill disposal", quantity: 15, unit: "t", unitRate: 80,
           formRowKey: "001-A:class_ii_landfill__disposal_fee" }),
    line({ costCategory: "scrap_metal", task: "Ferrous scrap value", quantity: 5, unit: "t", unitRate: 200,
           formRowKey: "001-A:ferrous_material_value", supportingDocumentId: "doc-scrap" }),
  ];
  ws.esa_remediation.lineItems = [
    line({ costCategory: "esa", task: "Phase 1 ESA", formRef: "001-B", formRowKey: "001-B:phase_1", unitRate: 8000 }),
    line({ costCategory: "esa", task: "Phase 2 ESA", formRef: "001-B", formRowKey: "001-B:phase_2", unitRate: 40000 }),
    line({ costCategory: "remediation_off_site", task: "Class II disposal", formRef: "001-B", quantity: 1800, unit: "t",
           unitRate: 85, formRowKey: "001-B:class_ii_landfill__disposal_fee" }),
    line({ costCategory: "backfill_import", task: "Backfill purchase and delivery", formRef: "001-B", quantity: 1000, unit: "t",
           unitRate: 22, formRowKey: "001-B:purchase_and_delivery" }),
    line({ costCategory: "backfill_import", task: "Backfill placement and compaction", formRef: "001-B", quantity: 1000, unit: "t",
           unitRate: 9, formRowKey: "001-B:placement_and_compaction" }),
    line({ costCategory: "overburden_topsoil_handling", task: "Strip and replace overburden", formRef: "001-B", quantity: 1, unit: "ls",
           unitRate: 15000, formRowKey: "001-B:equipment_including_mob_demob" }),
  ];
  ws.reclamation.lineItems = [
    line({ costCategory: "reclamation", task: "Topsoil placement", formRef: "001-B", quantity: 1.2, unit: "ha", unitRate: 9000,
           formRowKey: "001-B:topsoil_purchase_delivery_and_placement" }),
  ];
  ws.contingencies.lineItems = [
    line({ costCategory: "contingency", task: "General contingency", calcMode: "percent_of_base", quantity: 0.1, unit: "%",
           unitRate: 100000, contingencyKind: "general", rationale: "Ten percent for unforeseen site conditions.",
           rateSheetId: null, rateSheetRef: null, formRowKey: "001-A:contingency" }),
  ];
  ws.mgmt_admin.lineItems = REQ_5_ITEMS.filter((i) => i !== "k").map((i) =>
    line({ costCategory: "project_management", task: `Req 5(${i})`, req5Item: i, quantity: 1, unit: "ls", unitRate: 1000,
           formRowKey: "001-A:site_admin_costs_supervision_safety_utilities_trailers_taxes_etc" }),
  );

  const attested = { attestations: { noNpvDiscount: true } };
  const details = {
    care_security: parseDetails("care_security", attested),
    suspension: parseDetails("suspension", attested),
    abandonment: parseDetails("abandonment", attested),
    esa_remediation: parseDetails("esa_remediation", {
      ...attested,
      phase1OnestopId: "P1-0001",
      phase2OnestopId: "P2-0001",
      roscOnestopId: "ROSC-0001",
      remediationApproach: "tier1",
      apecs: [{ id: "apec-1", description: "Former tank area" }],
      offSiteDisposalPlanned: true,
      volumes: {
        affectedInSituM3: 1000,
        topsoilOverburdenM3: 500,
        plumeIrregularityFactor: 1.1,
        plumeBasis: "Plume fingers observed in BH-3 and BH-7",
        bulkingFactor: 1.3,
        bulkingBasis: "Typical for silty clay till",
        soilDensityTPerM3: 1.8,
        moisturePct: 12,
        densityMethod: "Shelby tube samples, ASTM D2937",
      },
    }),
    reclamation: parseDetails("reclamation", { ...attested, elementsAddressed: [...REQ_47_ELEMENTS] }),
    contingencies: parseDetails("contingencies", attested),
    mgmt_admin: parseDetails("mgmt_admin", attested),
  };

  return {
    site: { siteType: "well", isLandfill: false },
    now: NOW,
    workstreams: ws,
    details,
    rateSheets: [{ id: "rs1", title: "Acme Services 2026 rates", effectiveDate: "2026-06-01", discountType: "none" }],
    documents: [
      { id: "doc-scrap", kind: "scrap_support", title: "Recycler price list" },
      { id: "doc-drawing", kind: "site_drawing", title: "Site drawing with sample points" },
    ],
  };
}
