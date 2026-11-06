// GENERATED from reference/Directive001-Cost-Estimate-Forms.xlsx. Verified by templateMap.test.ts.
// Do not hand-edit row numbers: if AER revises the template, re-map and update TEMPLATE_SHA256.

export type FormRef = "001-A" | "001-B";

/** qty_rate: write quantity to col B and unit cost to col D (col F is a formula). direct: write the amount to col F. */
export type FormRowKind = "qty_rate" | "direct";

export interface FormRow {
  key: string;
  form: FormRef;
  row: number;
  label: string;
  block: string;
  kind: FormRowKind;
  /** Col B is a percentage (fraction) and col D is the base amount ($). */
  percentBased: boolean;
  /** Unit shown in col C (quantity) and col E (unit cost), as printed on the template. */
  qtyUnit: string | null;
  rateUnit: string | null;
}

export interface FormSubtotal {
  form: FormRef;
  row: number;
  block: string;
}

export const TEMPLATE_FILE = "reference/Directive001-Cost-Estimate-Forms.xlsx";
export const TEMPLATE_SHA256 = "040b6e264699f8e17ee986f9cc5b30978be8fa0f49028928902dbc73ca1e1c1d";

/** Header cells: value goes in col B (merged B:F) on rows 2-6 of each sheet. */
export const HEADER_ROWS = { licenceNumber: 2, licenceType: 3, legalLandDescription: 4, licenseeNameBaId: 5, siteName: 6 } as const;

export const SHEET_NAMES: Record<FormRef, string> = { "001-A": "Form 001-A", "001-B": "Form 001-B" };

export const FORM_ROWS: readonly FormRow[] = [
  {
    "key": "001-A:facility_suspension_purge_vessels_flow_lines",
    "form": "001-A",
    "row": 8,
    "label": "Facility Suspension (purge vessels, flow lines)",
    "block": "demolition_suspension_abandonment",
    "kind": "direct",
    "percentBased": false,
    "qtyUnit": null,
    "rateUnit": null
  },
  {
    "key": "001-A:facility_preparation_electrical_instrumental_disconnect",
    "form": "001-A",
    "row": 9,
    "label": "Facility Preparation (electrical/instrumental disconnect)",
    "block": "demolition_suspension_abandonment",
    "kind": "direct",
    "percentBased": false,
    "qtyUnit": null,
    "rateUnit": null
  },
  {
    "key": "001-A:concrete_demolition",
    "form": "001-A",
    "row": 10,
    "label": "Concrete Demolition",
    "block": "demolition_suspension_abandonment",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": "t",
    "rateUnit": "$/t"
  },
  {
    "key": "001-A:structural_demolition",
    "form": "001-A",
    "row": 11,
    "label": "Structural Demolition",
    "block": "demolition_suspension_abandonment",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": "t",
    "rateUnit": "$/t"
  },
  {
    "key": "001-A:building_demolition",
    "form": "001-A",
    "row": 12,
    "label": "Building Demolition",
    "block": "demolition_suspension_abandonment",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": "t",
    "rateUnit": "$/t"
  },
  {
    "key": "001-A:equipment_demolition",
    "form": "001-A",
    "row": 13,
    "label": "Equipment Demolition",
    "block": "demolition_suspension_abandonment",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": "t",
    "rateUnit": "$/t"
  },
  {
    "key": "001-A:vessels_demolition",
    "form": "001-A",
    "row": 14,
    "label": "Vessels Demolition",
    "block": "demolition_suspension_abandonment",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": "t",
    "rateUnit": "$/t"
  },
  {
    "key": "001-A:aboveground_piping_demolition",
    "form": "001-A",
    "row": 15,
    "label": "Aboveground Piping Demolition",
    "block": "demolition_suspension_abandonment",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": "t",
    "rateUnit": "$/t"
  },
  {
    "key": "001-A:belowground_facilities_piping_tanks_demolition",
    "form": "001-A",
    "row": 16,
    "label": "Belowground Facilities (piping/tanks) Demolition",
    "block": "demolition_suspension_abandonment",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": "t",
    "rateUnit": "$/t"
  },
  {
    "key": "001-A:hazardous_materials",
    "form": "001-A",
    "row": 17,
    "label": "Hazardous Materials",
    "block": "demolition_suspension_abandonment",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": "% or t",
    "rateUnit": "$/t"
  },
  {
    "key": "001-A:asbestos_piping_insulation",
    "form": "001-A",
    "row": 18,
    "label": "Asbestos - piping insulation",
    "block": "demolition_suspension_abandonment",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": "t",
    "rateUnit": "$/t"
  },
  {
    "key": "001-A:asbestos_building_insulation",
    "form": "001-A",
    "row": 19,
    "label": "Asbestos - building insulation",
    "block": "demolition_suspension_abandonment",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": "t",
    "rateUnit": "$/t"
  },
  {
    "key": "001-A:norms",
    "form": "001-A",
    "row": 20,
    "label": "NORMs",
    "block": "demolition_suspension_abandonment",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": "t",
    "rateUnit": "$/t"
  },
  {
    "key": "001-A:lead_pcbs_etc",
    "form": "001-A",
    "row": 21,
    "label": "Lead, PCBs, etc.",
    "block": "demolition_suspension_abandonment",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": "t",
    "rateUnit": "$/t"
  },
  {
    "key": "001-A:road_rail_airstrip_removal",
    "form": "001-A",
    "row": 22,
    "label": "Road/Rail/Airstrip Removal",
    "block": "demolition_suspension_abandonment",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": "m",
    "rateUnit": "$/m"
  },
  {
    "key": "001-A:other_costs_re_route_active_lines",
    "form": "001-A",
    "row": 23,
    "label": "Other Costs (re-route active lines)",
    "block": "demolition_suspension_abandonment",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": null,
    "rateUnit": null
  },
  {
    "key": "001-A:class_i_landfill__disposal_fee",
    "form": "001-A",
    "row": 27,
    "label": "Disposal Fee",
    "block": "transport_disposal",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": "t",
    "rateUnit": "$/t"
  },
  {
    "key": "001-A:class_i_landfill__transportation_and_loading_cost",
    "form": "001-A",
    "row": 28,
    "label": "Transportation and Loading Cost",
    "block": "transport_disposal",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": "km",
    "rateUnit": "$/km"
  },
  {
    "key": "001-A:class_ii_landfill__disposal_fee",
    "form": "001-A",
    "row": 30,
    "label": "Disposal Fee",
    "block": "transport_disposal",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": "t",
    "rateUnit": "$/t"
  },
  {
    "key": "001-A:class_ii_landfill__transportation_and_loading_cost",
    "form": "001-A",
    "row": 31,
    "label": "Transportation and Loading Cost",
    "block": "transport_disposal",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": "km",
    "rateUnit": "$/km"
  },
  {
    "key": "001-A:class_iii_landfill__disposal_fee",
    "form": "001-A",
    "row": 33,
    "label": "Disposal Fee",
    "block": "transport_disposal",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": "t",
    "rateUnit": "$/t"
  },
  {
    "key": "001-A:class_iii_landfill__transportation_and_loading_cost",
    "form": "001-A",
    "row": 34,
    "label": "Transportation and Loading Cost",
    "block": "transport_disposal",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": "km",
    "rateUnit": "$/km"
  },
  {
    "key": "001-A:norm_disposal__disposal_fee",
    "form": "001-A",
    "row": 36,
    "label": "Disposal Fee",
    "block": "transport_disposal",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": "t",
    "rateUnit": "$/t"
  },
  {
    "key": "001-A:norm_disposal__transportation_and_loading_cost",
    "form": "001-A",
    "row": 37,
    "label": "Transportation and Loading Cost",
    "block": "transport_disposal",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": "km",
    "rateUnit": "$/km"
  },
  {
    "key": "001-A:aep_licensed_incineration__disposal_fee",
    "form": "001-A",
    "row": 39,
    "label": "Disposal Fee",
    "block": "transport_disposal",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": "t",
    "rateUnit": "$/t"
  },
  {
    "key": "001-A:aep_licensed_incineration__transportation_and_loading_cost",
    "form": "001-A",
    "row": 40,
    "label": "Transportation and Loading Cost",
    "block": "transport_disposal",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": "km",
    "rateUnit": "$/km"
  },
  {
    "key": "001-A:liquids_disposal_from_suspension_and_abandonment__disposal_fee",
    "form": "001-A",
    "row": 42,
    "label": "Disposal Fee",
    "block": "transport_disposal",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": "m3",
    "rateUnit": "$/m3"
  },
  {
    "key": "001-A:liquids_disposal_from_suspension_and_abandonment__transportation_and_loading_cost",
    "form": "001-A",
    "row": 43,
    "label": "Transportation and Loading Cost",
    "block": "transport_disposal",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": "km",
    "rateUnit": "$/km"
  },
  {
    "key": "001-A:other_disposal__disposal_fee",
    "form": "001-A",
    "row": 45,
    "label": "Disposal Fee",
    "block": "transport_disposal",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": "t",
    "rateUnit": "$/t"
  },
  {
    "key": "001-A:other_disposal__transportation_and_loading_cost",
    "form": "001-A",
    "row": 46,
    "label": "Transportation and Loading Cost",
    "block": "transport_disposal",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": "km",
    "rateUnit": "$/km"
  },
  {
    "key": "001-A:sorting_and_sizing_cost",
    "form": "001-A",
    "row": 48,
    "label": "Sorting and Sizing Cost",
    "block": "transport_disposal",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": "t",
    "rateUnit": "$/t"
  },
  {
    "key": "001-A:scrap_metal_value__transportation_and_loading_cost",
    "form": "001-A",
    "row": 49,
    "label": "Transportation and Loading Cost",
    "block": "transport_disposal",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": "km",
    "rateUnit": "$/km"
  },
  {
    "key": "001-A:ferrous_material_value",
    "form": "001-A",
    "row": 50,
    "label": "Ferrous Material Value",
    "block": "transport_disposal",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": "t",
    "rateUnit": "$/t"
  },
  {
    "key": "001-A:nonferrous_material_value",
    "form": "001-A",
    "row": 51,
    "label": "Nonferrous Material Value",
    "block": "transport_disposal",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": "t",
    "rateUnit": "$/t"
  },
  {
    "key": "001-A:project_management_services",
    "form": "001-A",
    "row": 55,
    "label": "Project Management Services",
    "block": "project_management",
    "kind": "qty_rate",
    "percentBased": true,
    "qtyUnit": "%",
    "rateUnit": "$"
  },
  {
    "key": "001-A:project_engineering_and_supporting_services",
    "form": "001-A",
    "row": 56,
    "label": "Project Engineering and Supporting Services",
    "block": "project_management",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": null,
    "rateUnit": null
  },
  {
    "key": "001-A:subsistence_camp_cost",
    "form": "001-A",
    "row": 57,
    "label": "Subsistence/Camp Cost",
    "block": "project_management",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": null,
    "rateUnit": "$"
  },
  {
    "key": "001-A:site_admin_costs_supervision_safety_utilities_trailers_taxes_etc",
    "form": "001-A",
    "row": 58,
    "label": "Site Admin. Costs (supervision, safety, utilities, trailers, taxes, etc.)",
    "block": "project_management",
    "kind": "qty_rate",
    "percentBased": true,
    "qtyUnit": "%",
    "rateUnit": "$"
  },
  {
    "key": "001-A:contingency",
    "form": "001-A",
    "row": 61,
    "label": "Contingency",
    "block": "contingency",
    "kind": "qty_rate",
    "percentBased": true,
    "qtyUnit": "%",
    "rateUnit": "$"
  },
  {
    "key": "001-A:additional_reasonable_care_and_measures_and_security_3_years",
    "form": "001-A",
    "row": 62,
    "label": "Additional Reasonable Care and Measures, and Security (3 years)",
    "block": "care_and_security",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": null,
    "rateUnit": "$"
  },
  {
    "key": "001-B:phase_1",
    "form": "001-B",
    "row": 9,
    "label": "Phase 1",
    "block": "esa",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": null,
    "rateUnit": "$"
  },
  {
    "key": "001-B:phase_2",
    "form": "001-B",
    "row": 10,
    "label": "Phase 2",
    "block": "esa",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": null,
    "rateUnit": "$"
  },
  {
    "key": "001-B:in_situ_soil_remediation",
    "form": "001-B",
    "row": 13,
    "label": "In Situ Soil Remediation",
    "block": "on_site_remediation",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": "m3",
    "rateUnit": "$/m3"
  },
  {
    "key": "001-B:approaches_and_associated_tasks_e_g_land_treatment",
    "form": "001-B",
    "row": 14,
    "label": "Approaches and associated tasks (e.g., land treatment)",
    "block": "on_site_remediation",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": "t",
    "rateUnit": "$/t"
  },
  {
    "key": "001-B:ex_situ_soil_remediation",
    "form": "001-B",
    "row": 15,
    "label": "Ex Situ Soil Remediation",
    "block": "on_site_remediation",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": null,
    "rateUnit": "$"
  },
  {
    "key": "001-B:approaches_and_associated_tasks_e_g_biocell_hauling",
    "form": "001-B",
    "row": 16,
    "label": "Approaches and associated tasks (e.g., biocell, hauling)",
    "block": "on_site_remediation",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": "t",
    "rateUnit": "$/t"
  },
  {
    "key": "001-B:landfill_on_site",
    "form": "001-B",
    "row": 17,
    "label": "Landfill (on-site)",
    "block": "on_site_remediation",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": "t",
    "rateUnit": "$/t"
  },
  {
    "key": "001-B:other_specify",
    "form": "001-B",
    "row": 18,
    "label": "Other (specify:____________________)",
    "block": "on_site_remediation",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": "t",
    "rateUnit": "$/t"
  },
  {
    "key": "001-B:groundwater_well_installation_monitoring_and_decommissioning",
    "form": "001-B",
    "row": 19,
    "label": "Groundwater (well installation, monitoring, and decommissioning)",
    "block": "on_site_remediation",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": "m3",
    "rateUnit": "$/m3"
  },
  {
    "key": "001-B:groundwater_remediation_capital_operations_decommissioning",
    "form": "001-B",
    "row": 20,
    "label": "Groundwater remediation (capital, operations, decommissioning)",
    "block": "on_site_remediation",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": null,
    "rateUnit": "$"
  },
  {
    "key": "001-B:surface_water",
    "form": "001-B",
    "row": 21,
    "label": "Surface Water",
    "block": "on_site_remediation",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": "m3",
    "rateUnit": "$/m3"
  },
  {
    "key": "001-B:equipment_including_mob_demob",
    "form": "001-B",
    "row": 22,
    "label": "Equipment (including mob/demob)",
    "block": "on_site_remediation",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": null,
    "rateUnit": null
  },
  {
    "key": "001-B:backfilling",
    "form": "001-B",
    "row": 23,
    "label": "Backfilling",
    "block": "on_site_remediation",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": null,
    "rateUnit": null
  },
  {
    "key": "001-B:purchase_and_delivery",
    "form": "001-B",
    "row": 24,
    "label": "Purchase and Delivery",
    "block": "on_site_remediation",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": "t",
    "rateUnit": "t"
  },
  {
    "key": "001-B:placement_and_compaction",
    "form": "001-B",
    "row": 25,
    "label": "Placement and Compaction",
    "block": "on_site_remediation",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": "t",
    "rateUnit": "t"
  },
  {
    "key": "001-B:analytical_delineation_confirmatory_waste_characterization",
    "form": "001-B",
    "row": 26,
    "label": "Analytical (delineation, confirmatory, waste characterization)",
    "block": "on_site_remediation",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": null,
    "rateUnit": "$"
  },
  {
    "key": "001-B:professional_field_supervision_expenses_subsistence_camp_etc",
    "form": "001-B",
    "row": 27,
    "label": "Professional Field Supervision, Expenses, Subsistence/Camp, etc.",
    "block": "on_site_remediation",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": null,
    "rateUnit": "$"
  },
  {
    "key": "001-B:class_i_landfill__excavation_and_loading_cost",
    "form": "001-B",
    "row": 31,
    "label": "Excavation and Loading Cost",
    "block": "off_site_transport_disposal",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": "t",
    "rateUnit": "$/t"
  },
  {
    "key": "001-B:class_i_landfill__disposal_fee",
    "form": "001-B",
    "row": 32,
    "label": "Disposal Fee",
    "block": "off_site_transport_disposal",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": "t",
    "rateUnit": "$/t"
  },
  {
    "key": "001-B:class_i_landfill__transportation_cost",
    "form": "001-B",
    "row": 33,
    "label": "Transportation Cost",
    "block": "off_site_transport_disposal",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": "km",
    "rateUnit": "$/km"
  },
  {
    "key": "001-B:class_ii_landfill__excavation_and_loading_cost",
    "form": "001-B",
    "row": 35,
    "label": "Excavation and Loading Cost",
    "block": "off_site_transport_disposal",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": "t",
    "rateUnit": "$/t"
  },
  {
    "key": "001-B:class_ii_landfill__disposal_fee",
    "form": "001-B",
    "row": 36,
    "label": "Disposal Fee",
    "block": "off_site_transport_disposal",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": "t",
    "rateUnit": "$/t"
  },
  {
    "key": "001-B:class_ii_landfill__transportation_cost",
    "form": "001-B",
    "row": 37,
    "label": "Transportation Cost",
    "block": "off_site_transport_disposal",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": "km",
    "rateUnit": "$/km"
  },
  {
    "key": "001-B:class_iii_landfill__excavation_and_loading_cost",
    "form": "001-B",
    "row": 39,
    "label": "Excavation and Loading Cost",
    "block": "off_site_transport_disposal",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": "t",
    "rateUnit": "$/t"
  },
  {
    "key": "001-B:class_iii_landfill__disposal_fee",
    "form": "001-B",
    "row": 40,
    "label": "Disposal Fee",
    "block": "off_site_transport_disposal",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": "t",
    "rateUnit": "$/t"
  },
  {
    "key": "001-B:class_iii_landfill__transportation_cost",
    "form": "001-B",
    "row": 41,
    "label": "Transportation Cost",
    "block": "off_site_transport_disposal",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": "km",
    "rateUnit": "$/km"
  },
  {
    "key": "001-B:incineration__excavation_and_loading_cost",
    "form": "001-B",
    "row": 43,
    "label": "Excavation and Loading Cost",
    "block": "off_site_transport_disposal",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": "t",
    "rateUnit": "$/t"
  },
  {
    "key": "001-B:incineration__disposal_fee",
    "form": "001-B",
    "row": 44,
    "label": "Disposal Fee",
    "block": "off_site_transport_disposal",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": "t",
    "rateUnit": "$/t"
  },
  {
    "key": "001-B:incineration__transportation_cost",
    "form": "001-B",
    "row": 45,
    "label": "Transportation Cost",
    "block": "off_site_transport_disposal",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": "km",
    "rateUnit": "$/km"
  },
  {
    "key": "001-B:other_disposal__excavation_and_loading_cost",
    "form": "001-B",
    "row": 47,
    "label": "Excavation and Loading Cost",
    "block": "off_site_transport_disposal",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": "t",
    "rateUnit": "$/t"
  },
  {
    "key": "001-B:other_disposal__disposal_fee",
    "form": "001-B",
    "row": 48,
    "label": "Disposal Fee",
    "block": "off_site_transport_disposal",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": "t",
    "rateUnit": "$/t"
  },
  {
    "key": "001-B:other_disposal__transportation_cost",
    "form": "001-B",
    "row": 49,
    "label": "Transportation Cost",
    "block": "off_site_transport_disposal",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": "km",
    "rateUnit": "$/km"
  },
  {
    "key": "001-B:off_site_transport_disposal__professional_field_supervision_expenses_subsistence_camp_etc",
    "form": "001-B",
    "row": 50,
    "label": "Professional Field Supervision, Expenses, Subsistence/Camp, etc.",
    "block": "off_site_transport_disposal",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": null,
    "rateUnit": "$"
  },
  {
    "key": "001-B:gravel_removal_and_offsite_disposal",
    "form": "001-B",
    "row": 53,
    "label": "Gravel Removal and Offsite Disposal",
    "block": "reclamation",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": "t",
    "rateUnit": "$/t"
  },
  {
    "key": "001-B:decompaction",
    "form": "001-B",
    "row": 54,
    "label": "Decompaction",
    "block": "reclamation",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": "ha",
    "rateUnit": "$/ha"
  },
  {
    "key": "001-B:contouring",
    "form": "001-B",
    "row": 55,
    "label": "Contouring",
    "block": "reclamation",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": "ha",
    "rateUnit": "$/ha"
  },
  {
    "key": "001-B:topsoil_purchase_delivery_and_placement",
    "form": "001-B",
    "row": 56,
    "label": "Topsoil (purchase, delivery, and placement)",
    "block": "reclamation",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": "ha",
    "rateUnit": "$/ha"
  },
  {
    "key": "001-B:reclamation__equipment_including_mob_demob",
    "form": "001-B",
    "row": 57,
    "label": "Equipment (including mob/demob)",
    "block": "reclamation",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": null,
    "rateUnit": "$"
  },
  {
    "key": "001-B:vegetation_management_seeding_monitoring_weed_control_etc",
    "form": "001-B",
    "row": 58,
    "label": "Vegetation management (seeding, monitoring, weed control, etc.)",
    "block": "reclamation",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": "ha",
    "rateUnit": "$/ha"
  },
  {
    "key": "001-B:security_and_monitoring",
    "form": "001-B",
    "row": 59,
    "label": "Security and Monitoring",
    "block": "reclamation",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": null,
    "rateUnit": "$"
  },
  {
    "key": "001-B:reclamation__professional_field_supervision_expenses_subsistence_camp_etc",
    "form": "001-B",
    "row": 60,
    "label": "Professional Field Supervision, Expenses, Subsistence/Camp, etc.",
    "block": "reclamation",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": null,
    "rateUnit": "$"
  },
  {
    "key": "001-B:detailed_site_assessment_and_reclamation_certificate_application",
    "form": "001-B",
    "row": 61,
    "label": "Detailed Site Assessment and Reclamation Certificate Application",
    "block": "reclamation",
    "kind": "qty_rate",
    "percentBased": false,
    "qtyUnit": null,
    "rateUnit": "$"
  },
  {
    "key": "001-B:project_management_services",
    "form": "001-B",
    "row": 64,
    "label": "Project Management Services",
    "block": "project_management",
    "kind": "qty_rate",
    "percentBased": true,
    "qtyUnit": "%",
    "rateUnit": "$"
  },
  {
    "key": "001-B:project_supporting_services",
    "form": "001-B",
    "row": 65,
    "label": "Project Supporting Services",
    "block": "project_management",
    "kind": "qty_rate",
    "percentBased": true,
    "qtyUnit": "%",
    "rateUnit": "$"
  },
  {
    "key": "001-B:site_administrative_costs_supervision_safety_taxes_utilities_trailers_etc",
    "form": "001-B",
    "row": 66,
    "label": "Site Administrative Costs (supervision, safety, taxes, utilities, trailers, etc.)",
    "block": "project_management",
    "kind": "qty_rate",
    "percentBased": true,
    "qtyUnit": "%",
    "rateUnit": "$"
  },
  {
    "key": "001-B:contingency",
    "form": "001-B",
    "row": 69,
    "label": "Contingency",
    "block": "contingency",
    "kind": "qty_rate",
    "percentBased": true,
    "qtyUnit": "%",
    "rateUnit": "$"
  }
] as const;

export const FORM_SUBTOTALS: readonly FormSubtotal[] = [
  {
    "form": "001-A",
    "row": 24,
    "block": "demolition_suspension_abandonment"
  },
  {
    "form": "001-A",
    "row": 53,
    "block": "transport_disposal"
  },
  {
    "form": "001-A",
    "row": 59,
    "block": "project_management"
  },
  {
    "form": "001-A",
    "row": 64,
    "block": "total"
  },
  {
    "form": "001-B",
    "row": 11,
    "block": "esa"
  },
  {
    "form": "001-B",
    "row": 28,
    "block": "on_site_remediation"
  },
  {
    "form": "001-B",
    "row": 51,
    "block": "off_site_transport_disposal"
  },
  {
    "form": "001-B",
    "row": 62,
    "block": "reclamation"
  },
  {
    "form": "001-B",
    "row": 67,
    "block": "project_management"
  },
  {
    "form": "001-B",
    "row": 71,
    "block": "total"
  }
] as const;

export const FORM_ROW_BY_KEY: ReadonlyMap<string, FormRow> = new Map(FORM_ROWS.map((r) => [r.key, r]));
