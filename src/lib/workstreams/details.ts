import { z } from "zod";

/**
 * Per-workstream `workstream_details.data` contracts (JSONB). Every field is optional in
 * storage (drafts are never blocked); parsing fills defaults so rules see complete objects.
 * Bump SCHEMA_VERSION and add a migration step when a field changes meaning.
 */
export const SCHEMA_VERSION = 1;

const str = () => z.string().nullable().default(null);
const num = () => z.number().nullable().default(null);
const bool = () => z.boolean().default(false);

const attestations = z
  .object({
    /** Req. 4: no net present value, discounting or escalation applied to this workstream. */
    noNpvDiscount: bool(),
  })
  .default({});

const common = { attestations };

export const commonDetailsSchema = z.object(common);

export const abandonmentDetailsSchema = z.object({
  ...common,
  /** Req. 11: each pipeline segment is abandoned in place or removed. */
  pipelineSegments: z
    .array(
      z.object({
        id: z.string(),
        label: str(),
        method: z.enum(["in_place", "removed"]).nullable().default(null),
      }),
    )
    .default([]),
});

export const REQ_47_ELEMENTS = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"] as const;
export type Req47Element = (typeof REQ_47_ELEMENTS)[number];

export const reclamationDetailsSchema = z.object({
  ...common,
  /** Req. 47(a)-(j) elements the reclamation plan addresses. */
  elementsAddressed: z.array(z.enum(REQ_47_ELEMENTS)).default([]),
});

export const contingencyDetailsSchema = z.object({
  ...common,
  /** Req. 20, 49 */
  missingHistoryDeclared: bool(),
  missingHistorySearchMethods: str(),
  /** Req. 26, 49 */
  unevaluatedIssuesDeclared: bool(),
});

export const REQ_5_ITEMS = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k"] as const;
export type Req5Item = (typeof REQ_5_ITEMS)[number];

export const REQ_5_LABELS: Record<Req5Item, string> = {
  a: "initial planning",
  b: "regulatory applications and approvals",
  c: "on-site supervision",
  d: "reporting",
  e: "overall project coordination",
  f: "subcontractors and third-party services",
  g: "equipment rental",
  h: "consumable supplies",
  i: "mobilization time and travel expenses",
  j: "subsistence",
  k: "general contingency for unforeseen circumstances",
};

export const mgmtAdminDetailsSchema = z.object({
  ...common,
  /** Req. 5: a zero amount for an item is allowed only with a written reason. */
  req5ZeroRationale: z.record(z.enum(REQ_5_ITEMS), z.string()).default({}),
});

export const esaDetailsSchema = z.object({
  ...common,
  phase1OnestopId: str(), // Req. 17, 19, 58(d)
  phase2OnestopId: str(), // Req. 21, 58(d)
  roscOnestopId: str(), // Req. 17, 58(d)
  remediationApproach: z.enum(["tier1", "tier2"]).nullable().default(null), // Req. 36-37
  tier2OnestopId: str(), // Req. 37
  apecs: z.array(z.object({ id: z.string(), description: str() })).default([]), // Req. 19, 21
  restrictedAccess: z.object({ declared: bool(), rationale: str() }).default({}), // Req. 34
  groundwater: z
    .object({
      planned: bool(),
      contaminationApparent: bool(), // Req. 24
      lowerAquiferAssessed: bool(), // Req. 24
      sourceRemoval: str(), // Req. 42(a)
      approach: str(), // Req. 42(b)
      durationBasis: str(), // Req. 42(c)
      totalVolumeM3: num(), // Req. 42(d)
    })
    .default({}),
  volumes: z
    .object({
      affectedInSituM3: num(), // Req. 27
      topsoilOverburdenM3: num(), // Req. 30
      plumeIrregularityFactor: num(), // Req. 28
      plumeBasis: str(), // Req. 28
      bulkingFactor: num(), // Req. 29
      bulkingBasis: str(), // Req. 29
      bulkingJustification: str(), // Req. 29 (deviation outside 1.2-1.4)
      soilDensityTPerM3: num(), // Req. 32
      moisturePct: num(), // Req. 32
      densityMethod: str(), // Req. 33
    })
    .default({}),
  offSiteDisposalPlanned: bool(), // Req. 39(b)
  onSiteTreatment: z
    .object({
      planned: bool(),
      approach: str(), // Req. 41(a)
      siteSuitability: str(), // Req. 41(b)
      treatabilityResults: str(), // Req. 41(c)
      volumeM3: num(), // Req. 41(d)
      durationRationale: str(), // Req. 41(d)
    })
    .default({}),
  onSiteSystem: z
    .object({
      planned: bool(),
      systemType: str(), // Req. 45(a)
      dimensions: str(), // Req. 45(b)
      durationYears: num(), // Req. 45(d)
      omCostsIncluded: bool(), // Req. 45(e)-(f)
      abandonmentCostsIncluded: bool(), // Req. 45(g)
    })
    .default({}),
  inPlaceRemediation: z
    .object({
      planned: bool(), // Req. 40
      durationYears: num(),
      supportingDocumentId: str(),
    })
    .default({}),
});

export type CommonDetails = z.infer<typeof commonDetailsSchema>;
export type AbandonmentDetails = z.infer<typeof abandonmentDetailsSchema>;
export type ReclamationDetails = z.infer<typeof reclamationDetailsSchema>;
export type ContingencyDetails = z.infer<typeof contingencyDetailsSchema>;
export type MgmtAdminDetails = z.infer<typeof mgmtAdminDetailsSchema>;
export type EsaDetails = z.infer<typeof esaDetailsSchema>;

export interface DetailsByKind {
  care_security: CommonDetails;
  suspension: CommonDetails;
  abandonment: AbandonmentDetails;
  esa_remediation: EsaDetails;
  reclamation: ReclamationDetails;
  contingencies: ContingencyDetails;
  mgmt_admin: MgmtAdminDetails;
}

export const detailsSchemas = {
  care_security: commonDetailsSchema,
  suspension: commonDetailsSchema,
  abandonment: abandonmentDetailsSchema,
  esa_remediation: esaDetailsSchema,
  reclamation: reclamationDetailsSchema,
  contingencies: contingencyDetailsSchema,
  mgmt_admin: mgmtAdminDetailsSchema,
} as const;

/** Parse stored JSONB for a workstream kind; unknown/garbled data falls back to defaults. */
export function parseDetails<K extends keyof DetailsByKind>(kind: K, data: unknown): DetailsByKind[K] {
  const r = detailsSchemas[kind].safeParse(data ?? {});
  return (r.success ? r.data : detailsSchemas[kind].parse({})) as DetailsByKind[K];
}
