import type { WorkstreamKind } from "@/lib/validation/types";

export interface WorkstreamMeta {
  title: string;
  reqs: string;
  blurb: string;
}

export const WORKSTREAM_META: Record<WorkstreamKind, WorkstreamMeta> = {
  care_security: {
    title: "Reasonable care, measures and site security",
    reqs: "Req. 8",
    blurb: "A minimum of three years of reasonable care and measures and of site security. Enter durations in year, month, week or day units and use the categories Care and Security.",
  },
  suspension: {
    title: "Suspension",
    reqs: "Req. 9, 58(a), 58(b)",
    blurb: "Costs to suspend the well, facility or pipeline, including the items listed in Req. 9. Pipelines also need a discontinuation plan.",
  },
  abandonment: {
    title: "Abandonment",
    reqs: "Req. 10-12, 58(c)",
    blurb: "Costs to abandon the site. Pipelines must state abandon-in-place or removed for each segment. No salvage or resale credit; scrap metal only with supporting information.",
  },
  esa_remediation: {
    title: "ESA and remediation",
    reqs: "Req. 17-45, 58(d), 58(e)",
    blurb: "Phase 1 and Phase 2 ESA references, affected volumes, bulking factor, on-site versus off-site treatment, and groundwater. Cite OneStop submission IDs; do not upload remedial action plans.",
  },
  reclamation: {
    title: "Reclamation",
    reqs: "Req. 46-47, 58(f)",
    blurb: "Costs to reclaim the land to a state eligible for a reclamation certificate (Req. 47 (a)-(j)).",
  },
  contingencies: {
    title: "Contingencies",
    reqs: "Req. 5(k), 20, 26, 34(a), 49",
    blurb: "Each contingency is a separate line with a rationale: general, missing history, unevaluated issues, restricted access.",
  },
  mgmt_admin: {
    title: "Management and administration",
    reqs: "Req. 5",
    blurb: "Items (a)-(j) of Req. 5 must be provided for every project. Tag each line with the item it covers, or explain below why an item is zero. Item (k), general contingency, is on the Contingencies workstream.",
  },
};

export const STATUS_LABEL: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  submitted: "Submitted",
  changes_requested: "Changes requested",
  approved: "Approved",
};

export const STATUS_TONE: Record<string, "grey" | "amber" | "green" | "red"> = {
  not_started: "grey",
  in_progress: "amber",
  submitted: "amber",
  changes_requested: "red",
  approved: "green",
};
