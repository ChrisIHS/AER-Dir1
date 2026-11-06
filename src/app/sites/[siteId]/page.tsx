import Link from "next/link";
import { Badge, Flash, IssueList } from "@/components/ui";
import { summarizeCosts } from "@/lib/costs";
import { requireSiteAccess, seesAll } from "@/lib/db/access";
import { loadSiteBundle } from "@/lib/db/load";
import { formatCad } from "@/lib/money";
import { trackerForSite } from "@/lib/tracker/forSite";
import { overallStatus } from "@/lib/tracker/tracker";
import { countsByWorkstream, validate } from "@/lib/validation/engine";
import { WORKSTREAM_KINDS, type Issue } from "@/lib/validation/types";
import { STATUS_LABEL, STATUS_TONE, WORKSTREAM_META } from "@/lib/workstreams/meta";
import { saveManualStatus } from "../../actions/sites";

export default async function SitePage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { siteId } = await params;
  const { error, ok } = await searchParams;
  const a = await requireSiteAccess(siteId);
  const bundle = await loadSiteBundle(siteId);

  // Which workstreams may this user see? RLS decides (contractors: assigned ones only).
  const { data: visible } = await a.supabase.from("workstreams").select("id, kind").eq("assessment_id", bundle.assessment.id);
  const visibleKinds = new Set((visible ?? []).map((w) => w.kind as string));
  const full = seesAll(a);

  const allIssues = validate(bundle.ctx);
  const issues: Issue[] = allIssues.filter((i) => visibleKinds.has(i.workstream));
  const counts = countsByWorkstream(issues);
  const cost = summarizeCosts(bundle.ctx);
  const manual = bundle.assessment.manual_status;

  const tracker = full ? trackerForSite(bundle, allIssues) : [];
  const overall = overallStatus(tracker);
  const s = bundle.site;

  return (
    <>
      <p className="sub"><Link href="/sites">← Sites</Link></p>
      <h1>{s.site_name || s.licence_no || "Untitled site"}</h1>
      <p className="sub">
        {s.site_type.replace("_", " ")}{s.is_landfill ? " · landfill" : ""} · Licence {s.licence_no ?? "NEW"} · {s.lsd ?? "no location"} · Assessment v{bundle.assessment.version_no}
      </p>
      <p>
        {a.isLicenseeAdmin && <Link className="btn secondary" href={`/sites/${siteId}/access`}>Access and assignments</Link>}{" "}
        <Link className="btn secondary" href={`/sites/${siteId}/rate-sheets`}>Rate sheets</Link>{" "}
        <Link className="btn secondary" href={`/sites/${siteId}/documents`}>Documents</Link>{" "}
        {(a.isLicenseeAdmin || a.isAssessor) && <Link className="btn secondary" href={`/sites/${siteId}/report`}>Report details</Link>}{" "}
        {full && <Link className="btn secondary" href={`/sites/${siteId}/signoff`}>Sign-off</Link>}{" "}
        {full && <Link className="btn secondary" href={`/sites/${siteId}/export`}>Forms and package</Link>}{" "}
        {(a.isLicenseeAdmin || a.isAssessor) && <Link className="btn secondary" href={`/sites/${siteId}/audit`}>Audit log</Link>}
      </p>
      <Flash error={error} ok={ok} />

      <h2>Workstreams</h2>
      <div className="scroll">
        <table>
          <thead>
            <tr><th>Workstream</th><th>Requirements</th><th>Status</th><th>Assigned to</th><th>Issues</th><th className="num">Subtotal</th></tr>
          </thead>
          <tbody>
            {WORKSTREAM_KINDS.filter((k) => visibleKinds.has(k)).map((k) => {
              const c = counts[k];
              const w = bundle.workstreams[k];
              return (
                <tr key={k}>
                  <td><Link href={`/sites/${siteId}/w/${k}`}>{WORKSTREAM_META[k].title}</Link>{w.applicable ? "" : " (not applicable)"}</td>
                  <td>{WORKSTREAM_META[k].reqs}</td>
                  <td><Badge tone={STATUS_TONE[w.status]!}>{STATUS_LABEL[w.status]}</Badge></td>
                  <td>{bundle.owners.workstream[k] ?? <span className="sub">unassigned</span>}</td>
                  <td>
                    {c.block > 0 && <Badge tone="red">{c.block} blocking</Badge>}{" "}
                    {c.warn > 0 && <Badge tone="amber">{c.warn} warning{c.warn === 1 ? "" : "s"}</Badge>}
                    {c.block === 0 && c.warn === 0 && <Badge tone="green">clear</Badge>}
                  </td>
                  <td className="num">{formatCad(cost.byWorkstream[k])}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {full && (
        <>
          <h2>Cost summary</h2>
          <div className="card">
            <table>
              <tbody>
                <tr><td>Form 001-A: reasonable care and measures, suspension and abandonment</td><td className="num">{formatCad(cost.byForm["001-A"])}</td></tr>
                <tr><td>Form 001-B: remediation and surface land reclamation</td><td className="num">{formatCad(cost.byForm["001-B"])}</td></tr>
                <tr><td><strong>Total (undiscounted, current-day; Req. 3, 4)</strong></td><td className="num"><strong>{formatCad(cost.grand)}</strong></td></tr>
              </tbody>
            </table>
            {cost.scrapCredit > 0 && <p className="sub">Includes a scrap-metal credit of {formatCad(cost.scrapCredit)} (Req. 12).</p>}
            {cost.unassigned.count > 0 && <p className="sub">{cost.unassigned.count} line(s) have no AER form row and will not appear on the exported forms.</p>}
          </div>

          <h2>Completeness (Req. 58)</h2>
          <p className="sub">
            {overall.green} complete · {overall.amber} in progress · {overall.red} missing · {overall.na} not applicable
            {overall.ready ? " · ready to assemble the package" : ""}
          </p>
          <div className="scroll">
            <table>
              <thead><tr><th>Item</th><th>Requirement</th><th>Status</th><th>Owner</th><th>Detail</th></tr></thead>
              <tbody>
                {tracker.map((t) => (
                  <tr key={t.ref}>
                    <td>{t.ref}. {t.title}</td>
                    <td>{t.req}</td>
                    <td><Badge tone={t.status === "na" ? "na" : t.status}>{{ red: "Missing", amber: "In progress", green: "Complete", na: "N/A" }[t.status]}</Badge></td>
                    <td>{t.owner ?? ""}</td>
                    <td>{t.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h2>All issues</h2>
      <IssueList issues={issues} empty="No issues on the workstreams you can see." />

      {a.isLicenseeAdmin && (
        <>
          <h2>Confirmations the app cannot derive</h2>
          <form action={saveManualStatus} className="card">
            <input type="hidden" name="site_id" value={siteId} />
            <div className="row">
              <div>
                <label htmlFor="ld">Liability Declaration Form F035 (Req. 58(g)(i))</label>
                <select id="ld" name="liabilityDeclaration" defaultValue={manual.liabilityDeclaration ?? "none"}>
                  <option value="none">Not generated</option>
                  <option value="generated">Generated, awaiting senior officer signature</option>
                  <option value="signed">Signed</option>
                </select>
              </div>
              <div>
                <label className="inline" style={{ marginTop: 28 }}>
                  <input type="checkbox" name="costFormsGenerated" defaultChecked={manual.costFormsGenerated ?? false} />
                  Cost Estimate Forms 001-A and 001-B are completed (Req. 58(g)(ii))
                </label>
              </div>
            </div>
            <label htmlFor="sr">No additional supporting information is required because… (Req. 58(i); leave empty if you upload documents)</label>
            <input id="sr" name="supportingReason" defaultValue={manual.supportingInfoNoneRequiredReason ?? ""} />
            <div className="row">
              <div><label htmlFor="ad">Estimate entered in the AER&apos;s designated system on (Req. 58(k))</label><input id="ad" name="aer_date" type="date" defaultValue={manual.aerSystemUpdate?.date ?? ""} /></div>
              <div><label htmlFor="ar">Reference</label><input id="ar" name="aer_ref" defaultValue={manual.aerSystemUpdate?.reference ?? ""} /></div>
            </div>
            <p><button type="submit">Save confirmations</button></p>
          </form>
        </>
      )}
    </>
  );
}
