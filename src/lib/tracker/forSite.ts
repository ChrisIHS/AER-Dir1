import type { SiteBundle } from "@/lib/db/load";
import type { Issue } from "@/lib/validation/types";
import { computeTracker, type TrackerItem } from "./tracker";

/** Req. 58 tracker for a loaded site (shared by the site page, the sign-off page and the package builder). */
export function trackerForSite(bundle: SiteBundle, issues: Issue[]): TrackerItem[] {
  const manual = bundle.assessment.manual_status;
  return computeTracker({
    ctx: bundle.ctx,
    issues,
    workstreamStatus: bundle.statuses,
    owners: bundle.owners,
    manual: {
      // A current e-signature wins; a stale one means the figures changed after signing.
      liabilityDeclaration:
        bundle.officer.state === "valid" ? "signed" : bundle.officer.state === "stale" ? "generated" : (manual.liabilityDeclaration ?? "none"),
      costFormsGenerated: manual.costFormsGenerated ?? false,
      signoffs: bundle.signoffs,
      supportingInfoNoneRequiredReason: manual.supportingInfoNoneRequiredReason ?? null,
      aerSystemUpdate: manual.aerSystemUpdate ?? null,
    },
  });
}
