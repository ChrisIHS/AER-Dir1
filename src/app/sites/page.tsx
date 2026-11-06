import Link from "next/link";
import { Badge, Flash } from "@/components/ui";
import { loadPortfolio } from "@/lib/db/portfolio";
import { formatCad } from "@/lib/money";
import { portfolioTotals, STAGE_LABEL, STAGE_ORDER, type Stage } from "@/lib/portfolio";
import { STATUS_LABEL, STATUS_TONE, WORKSTREAM_META } from "@/lib/workstreams/meta";
import { requireMembership } from "@/lib/db/access";
import type { SiteRow } from "@/lib/db/types";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { facilityTypeOptions } from "@/lib/forms/f035";
import { createSite } from "../actions/sites";

const TYPE_LABEL: Record<string, string> = { well: "Well", facility: "Facility", pipeline: "Pipeline", owm_facility: "Oilfield waste facility" };

export default async function SitesPage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string; stage?: string }> }) {
  const { supabase, memberships } = await requireMembership();
  const { error, ok, stage } = await searchParams;
  const portfolio = await loadPortfolio();
  const totals = portfolioTotals(portfolio.summaries);
  const filter = STAGE_ORDER.includes(stage as Stage) ? (stage as Stage) : null;
  const shown = filter ? portfolio.summaries.filter((s) => s.stage === filter) : portfolio.summaries;
  const { data } = await supabase
    .from("sites")
    .select("id, licensee_org_id, site_type, is_landfill, licence_no, lsd, site_name, facility_type")
    .order("created_at", { ascending: false });
  const sites = (data ?? []) as SiteRow[];
  const facilityTypes = await facilityTypeOptions(await readFile(path.join(process.cwd(), "reference", "Directive001-F035_LiabilityDeclaration.pdf")));
  const adminLicensees = memberships.filter((m) => m.org.kind === "licensee" && m.role === "admin");

  return (
    <>
      <h1>Sites</h1>
      <Flash error={error} ok={ok} />

      {portfolio.summaries.length > 0 && (
        <>
          <h2 style={{ marginTop: 8 }}>Portfolio</h2>
          <div className="row" style={{ marginBottom: 8 }}>
            <div className="card"><div className="sub">Sites</div><strong style={{ fontSize: "1.4rem" }}>{totals.sites}</strong></div>
            <div className="card"><div className="sub">Total estimate</div><strong style={{ fontSize: "1.4rem" }}>{formatCad(totals.estimateCents)}</strong></div>
            <div className="card"><div className="sub">Blocking issues</div><strong style={{ fontSize: "1.4rem" }}>{totals.blocking}</strong></div>
          </div>
          <p>
            <Link className={`btn ${filter ? "secondary" : ""}`} href="/sites">All ({totals.sites})</Link>{" "}
            {STAGE_ORDER.filter((s) => totals.byStage[s] > 0).map((s) => (
              <span key={s}><Link className={`btn ${filter === s ? "" : "secondary"}`} href={`/sites?stage=${s}`}>{STAGE_LABEL[s]} ({totals.byStage[s]})</Link>{" "}</span>
            ))}
            <a className="btn secondary" href="/sites/portfolio.csv">Download CSV</a>
          </p>
          <div className="scroll">
            <table>
              <thead>
                <tr><th>Site</th><th>Stage</th><th>Approved</th><th>Issues</th><th>Req. 58</th><th className="num">Estimate</th><th>Next action</th></tr>
              </thead>
              <tbody>
                {shown.map((s) => (
                  <tr key={s.siteId}>
                    <td><Link href={`/sites/${s.siteId}`}>{s.name}</Link><div className="sub">{s.siteType.replace("_", " ")} · {s.licenceNumber}</div></td>
                    <td><Badge tone={s.stage === "signed" || s.stage === "packaged" ? "green" : s.stage === "setup" ? "grey" : "amber"}>{STAGE_LABEL[s.stage]}</Badge></td>
                    <td>{s.approved} / {s.applicable}</td>
                    <td>
                      {s.blocking > 0 && <Badge tone="red">{s.blocking} blocking</Badge>}{" "}
                      {s.warnings > 0 && <Badge tone="amber">{s.warnings} warn</Badge>}
                      {s.blocking === 0 && s.warnings === 0 && <Badge tone="green">clear</Badge>}
                    </td>
                    <td className="mono">{s.tracker.green}✓ {s.tracker.amber}… {s.tracker.red}✗</td>
                    <td className="num">{formatCad(s.estimateCents)}</td>
                    <td>{s.nextAction}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {shown.length === 0 && <p className="sub">No sites at this stage.</p>}
        </>
      )}

      {portfolio.work.length > 0 && (
        <>
          <h2>My work</h2>
          <div className="scroll">
            <table>
              <thead><tr><th>Site</th><th>Workstream</th><th>Status</th><th>Issues</th></tr></thead>
              <tbody>
                {portfolio.work.map((w) => (
                  <tr key={`${w.siteId}-${w.kind}`}>
                    <td>{w.siteName}</td>
                    <td><Link href={`/sites/${w.siteId}/w/${w.kind}`}>{WORKSTREAM_META[w.kind].title}</Link></td>
                    <td><Badge tone={STATUS_TONE[w.status]!}>{STATUS_LABEL[w.status]}</Badge></td>
                    <td>
                      {w.blocking > 0 && <Badge tone="red">{w.blocking} blocking</Badge>}{" "}
                      {w.warnings > 0 && <Badge tone="amber">{w.warnings} warn</Badge>}
                      {w.blocking === 0 && w.warnings === 0 && <Badge tone="green">clear</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {portfolio.failed.length > 0 && <div className="flash error">Couldn&apos;t summarise: {portfolio.failed.join(", ")}.</div>}

      <h2>All sites</h2>
      {sites.length === 0 ? (
        <p className="sub">No sites yet. Licensees create sites; contractors and assessors see a site once a licensee grants their organization access.</p>
      ) : (
        <div className="scroll">
          <table>
            <thead>
              <tr><th>Site</th><th>Type</th><th>Licence</th><th>Location</th></tr>
            </thead>
            <tbody>
              {sites.map((s) => (
                <tr key={s.id}>
                  <td><Link href={`/sites/${s.id}`}>{s.site_name || s.licence_no || "Untitled site"}</Link>{s.is_landfill ? " (landfill)" : ""}</td>
                  <td>{TYPE_LABEL[s.site_type]}</td>
                  <td>{s.licence_no ?? "NEW"}</td>
                  <td>{s.lsd ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adminLicensees.length > 0 && (
        <>
          <h2>Create a site</h2>
          <form action={createSite} className="card">
            <div className="row">
              <div>
                <label htmlFor="licensee_org_id">Licensee organization</label>
                <select id="licensee_org_id" name="licensee_org_id" required>
                  {adminLicensees.map((m) => <option key={m.org.id} value={m.org.id}>{m.org.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="site_type">Site type</label>
                <select id="site_type" name="site_type" required defaultValue="well">
                  <option value="well">Well</option>
                  <option value="facility">Facility</option>
                  <option value="pipeline">Pipeline</option>
                  <option value="owm_facility">Oilfield waste management facility</option>
                </select>
              </div>
            </div>
            <div className="row">
              <div><label htmlFor="site_name">Site name (optional)</label><input id="site_name" name="site_name" /></div>
              <div><label htmlFor="licence_no">AER licence or approval number (blank = new)</label><input id="licence_no" name="licence_no" /></div>
              <div><label htmlFor="lsd">Legal land description (LSD)</label><input id="lsd" name="lsd" /></div>
            </div>
            <label htmlFor="facility_type">Facility description (facilities only; Directive 056 Table 1, used on the Liability Declaration)</label>
            <select id="facility_type" name="facility_type" defaultValue="">
              <option value="">Not a facility / not sure yet</option>
              {facilityTypes.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            <label className="inline"><input type="checkbox" name="is_landfill" /> This is an oilfield landfill (only Req. 14 applies to remediation and reclamation; Req. 15)</label>
            <p><button type="submit">Create site</button></p>
          </form>
        </>
      )}

      <h2>Your organization{memberships.length > 1 ? "s" : ""}</h2>
      <div className="card">
        {memberships.map((m) => (
          <p key={m.org.id} style={{ margin: "4px 0" }}>
            <strong>{m.org.name}</strong> ({m.org.kind.replace("_", " ")}, {m.role})<br />
            <span className="sub">Organization ID, to give a licensee who is granting you access:</span> <span className="mono">{m.org.id}</span>
          </p>
        ))}
        {memberships.length < 3 && (
          <p className="sub" style={{ marginBottom: 0 }}>
            Need a different role (for example a licensee as well as a contractor)? <Link href="/onboarding?new=1">Add another organization</Link>.
          </p>
        )}
      </div>
    </>
  );
}
