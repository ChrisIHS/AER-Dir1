import type { Rule } from "../types";
import { v01NoNpv } from "./v01-no-npv";
import { v02NoSalvage } from "./v02-no-salvage";
import { v03ScrapSupport } from "./v03-scrap-support";
import { v04RateSheetLink } from "./v04-rate-sheet-link";
import { v05ClientDiscount } from "./v05-client-discount";
import { v06RateStaleness } from "./v06-rate-staleness";
import { v07BulkingFactor } from "./v07-bulking-factor";
import { v08CareSecurityYears } from "./v08-care-security-years";
import { v09PipelineMethod } from "./v09-pipeline-method";
import { v10Phase1Id } from "./v10-phase1-id";
import { v11Tier2Id } from "./v11-tier2-id";
import { v12ApecPhase2 } from "./v12-apec-phase2";
import { v13RoscId } from "./v13-rosc-id";
import { v14BackfillSeparate } from "./v14-backfill-separate";
import { v15Req5Items } from "./v15-req5-items";
import { v16Contingencies } from "./v16-contingencies";
import { v17VolumeBasis } from "./v17-volume-basis";
import { v18DensityMoisture } from "./v18-density-moisture";
import { v19TreatmentDetail } from "./v19-treatment-detail";
import { v20LandfillInfo } from "./v20-landfill-info";
import { v21ReclamationElements } from "./v21-reclamation-elements";
import { v24MaterialBalance } from "./v24-material-balance";

/** V-22, V-23 (sign-off) and V-25 (package) arrive in Phase 2. */
export const RULES: Record<string, Rule> = {
  "V-01": v01NoNpv,
  "V-02": v02NoSalvage,
  "V-03": v03ScrapSupport,
  "V-04": v04RateSheetLink,
  "V-05": v05ClientDiscount,
  "V-06": v06RateStaleness,
  "V-07": v07BulkingFactor,
  "V-08": v08CareSecurityYears,
  "V-09": v09PipelineMethod,
  "V-10": v10Phase1Id,
  "V-11": v11Tier2Id,
  "V-12": v12ApecPhase2,
  "V-13": v13RoscId,
  "V-14": v14BackfillSeparate,
  "V-15": v15Req5Items,
  "V-16": v16Contingencies,
  "V-17": v17VolumeBasis,
  "V-18": v18DensityMoisture,
  "V-19": v19TreatmentDetail,
  "V-20": v20LandfillInfo,
  "V-21": v21ReclamationElements,
  "V-24": v24MaterialBalance,
};
