import Link from "next/link";
import { notFound } from "next/navigation";
import { Flash } from "@/components/ui";
import { requireSiteAccess } from "@/lib/db/access";
import { WORKSTREAM_KINDS } from "@/lib/validation/types";
import { WORKSTREAM_META } from "@/lib/workstreams/meta";
import { assignWorkstream, grantAccess, revokeAccess, unassignWorkstream } from "../../../actions/sites";

type OrgName = { name: string } | null;

export default async function AccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { siteId } = await params;
  const { error, ok } = await searchParams;
  const a = await requireSiteAccess(siteId);
  if (!a.isLicenseeAdmin) notFound();

  const { data: grants } = await a.supabase
    .from("site_grants")
    .select("id, role, grantee_org_id, organizations(name)")
    .eq("site_id", siteId)
    .order("created_at");
  const { data: assessment } = await a.supabase.from("assessments").select("id").eq("site_id", siteId).order("version_no", { ascending: false }).limit(1).single();
  const { data: workstreams } = await a.supabase.from("workstreams").select("id, kind").eq("assessment_id", assessment!.id);
  const wsIds = (workstreams ?? []).map((w) => w.id);
  const { data: assignments } = await a.supabase
    .from("workstream_assignments")
    .select("id, workstream_id, org_id, organizations(name)")
    .in("workstream_id", wsIds);

  const contractors = (grants ?? []).filter((g) => g.role === "contractor");
  const wsByKind = new Map((workstreams ?? []).map((w) => [w.kind as string, w.id as string]));
  const nameOf = (o: unknown) => (o as OrgName)?.name ?? "Unknown organization";

  return (
    <>
      <p className="sub"><Link href={`/sites/${siteId}`}>← Site</Link></p>
      <h1>Access and assignments</h1>
      <p className="sub">
        Grant another organization access to this site, then assign them workstreams. A contractor only ever sees the workstreams assigned to them.
        Ask the other organization for its ID: it is shown on their Sites page.
      </p>
      <Flash error={error} ok={ok} />

      <h2>Organizations with access</h2>
      {(grants ?? []).length === 0 ? <p className="sub">None yet.</p> : (
        <table>
          <thead><tr><th>Organization</th><th>Role</th><th /></tr></thead>
          <tbody>
            {(grants ?? []).map((g) => (
              <tr key={g.id}>
                <td>{nameOf(g.organizations)}</td>
                <td>{g.role === "lead_assessor" ? "Lead assessor" : "Contractor"}</td>
                <td>
                  <form action={revokeAccess}>
                    <input type="hidden" name="site_id" value={siteId} />
                    <input type="hidden" name="grant_id" value={g.id} />
                    <button className="danger" type="submit">Revoke</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <form action={grantAccess} className="card">
        <input type="hidden" name="site_id" value={siteId} />
        <div className="row">
          <div><label htmlFor="org_id">Organization ID</label><input id="org_id" name="org_id" className="mono" placeholder="00000000-0000-0000-0000-000000000000" required /></div>
          <div>
            <label htmlFor="role">Role on this site</label>
            <select id="role" name="role" defaultValue="contractor">
              <option value="contractor">Contractor (edits assigned workstreams)</option>
              <option value="lead_assessor">Lead assessor (reviews everything, signs)</option>
            </select>
          </div>
        </div>
        <p><button type="submit">Grant access</button></p>
      </form>

      <h2>Workstream assignments</h2>
      <div className="scroll">
        <table>
          <thead><tr><th>Workstream</th><th>Assigned to</th><th>Assign</th></tr></thead>
          <tbody>
            {WORKSTREAM_KINDS.map((k) => {
              const wsId = wsByKind.get(k)!;
              const mine = (assignments ?? []).filter((x) => x.workstream_id === wsId);
              const assigned = new Set(mine.map((x) => x.org_id));
              const options = contractors.filter((g) => !assigned.has(g.grantee_org_id));
              return (
                <tr key={k}>
                  <td>{WORKSTREAM_META[k].title}</td>
                  <td>
                    {mine.length === 0 && <span className="sub">unassigned</span>}
                    {mine.map((x) => (
                      <form key={x.id} action={unassignWorkstream} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                        <input type="hidden" name="site_id" value={siteId} />
                        <input type="hidden" name="assignment_id" value={x.id} />
                        {nameOf(x.organizations)} <button className="secondary" type="submit">Remove</button>
                      </form>
                    ))}
                  </td>
                  <td>
                    {options.length > 0 && (
                      <form action={assignWorkstream} style={{ display: "flex", gap: 8 }}>
                        <input type="hidden" name="site_id" value={siteId} />
                        <input type="hidden" name="workstream_id" value={wsId} />
                        <select name="org_id" required defaultValue="" aria-label={`Assign ${WORKSTREAM_META[k].title}`}>
                          <option value="" disabled>Choose contractor…</option>
                          {options.map((g) => <option key={g.id} value={g.grantee_org_id}>{nameOf(g.organizations)}</option>)}
                        </select>
                        <button type="submit">Assign</button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
