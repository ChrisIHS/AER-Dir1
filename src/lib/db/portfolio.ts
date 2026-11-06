import "server-only";
import { summarizeCosts } from "@/lib/costs";
import { requireMembership } from "@/lib/db/access";
import { loadSiteBundle } from "@/lib/db/load";
import type { SiteRow } from "@/lib/db/types";
import { summarizeSite, workItems, type SiteSummary, type WorkItem } from "@/lib/portfolio";
import { trackerForSite } from "@/lib/tracker/forSite";
import { validate } from "@/lib/validation/engine";
import { WORKSTREAM_KINDS } from "@/lib/validation/types";

export interface Portfolio {
  /** Sites where the user is licensee staff or the lead assessor: full cross-workstream summary. */
  summaries: SiteSummary[];
  /** Workstreams assigned to the user's organizations on sites where they are only a contractor. */
  work: WorkItem[];
  failed: string[];
}

/** Process in small batches so a large portfolio doesn't open dozens of database connections at once. */
async function inBatches<T, R>(items: T[], size: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  return out;
}

export async function loadPortfolio(): Promise<Portfolio> {
  const { supabase, memberships } = await requireMembership();
  const myOrgs = memberships.map((m) => m.org.id);

  const { data: sites } = await supabase.from("sites").select("id, licensee_org_id, site_type, is_landfill, licence_no, lsd, site_name, facility_type");
  const { data: grants } = await supabase.from("site_grants").select("site_id, grantee_org_id, role");

  const summaries: SiteSummary[] = [];
  const work: WorkItem[] = [];
  const failed: string[] = [];

  await inBatches((sites ?? []) as SiteRow[], 4, async (site) => {
    const mine = (grants ?? []).filter((g) => g.site_id === site.id && myOrgs.includes(g.grantee_org_id));
    const full = myOrgs.includes(site.licensee_org_id) || mine.some((g) => g.role === "lead_assessor");
    const contractorOrgs = mine.filter((g) => g.role === "contractor").map((g) => g.grantee_org_id);
    try {
      const b = await loadSiteBundle(site.id);
      const issues = validate(b.ctx);
      const name = site.site_name || site.licence_no || "Untitled site";
      if (full) {
        summaries.push(
          summarizeSite({
            siteId: site.id,
            name,
            siteType: site.site_type,
            licenceNumber: site.licence_no ?? "NEW",
            isLandfill: site.is_landfill,
            workstreams: Object.fromEntries(
              WORKSTREAM_KINDS.map((k) => [
                k,
                {
                  applicable: b.workstreams[k].applicable,
                  status: b.statuses[k],
                  assigned: b.assignments.some((x) => x.workstream_id === b.workstreams[k].id),
                },
              ]),
            ) as never,
            issues,
            tracker: trackerForSite(b, issues),
            estimateCents: summarizeCosts(b.ctx).grand,
            signoffs: b.signoffs,
            officer: b.officer.state,
            packageCount: b.packageCount,
          }),
        );
      } else if (contractorOrgs.length > 0) {
        work.push(
          ...workItems({
            siteId: site.id,
            siteName: name,
            statuses: b.statuses,
            workstreamIds: Object.fromEntries(WORKSTREAM_KINDS.map((k) => [k, b.workstreams[k].id])) as never,
            assignments: b.assignments,
            issues,
            myOrgIds: contractorOrgs,
          }),
        );
      }
    } catch {
      failed.push(site.site_name || site.licence_no || site.id);
    }
  });

  summaries.sort((a, b) => a.name.localeCompare(b.name));
  return { summaries, work, failed };
}
