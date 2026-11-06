import Link from "next/link";
import { notFound } from "next/navigation";
import { Flash } from "@/components/ui";
import { requireSiteAccess } from "@/lib/db/access";
import { addPersonnel, deletePersonnel, saveReport } from "../../../actions/phase2";

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { siteId } = await params;
  const { error, ok } = await searchParams;
  const a = await requireSiteAccess(siteId);
  if (!a.isLicenseeAdmin && !a.isAssessor) notFound();

  const { data: asm } = await a.supabase
    .from("assessments")
    .select("id, assessment_date, limitations_text, locked_at")
    .eq("site_id", siteId)
    .order("version_no", { ascending: false })
    .limit(1)
    .single();
  const { data: people } = await a.supabase
    .from("personnel")
    .select("id, name, role, technical_training, experience")
    .eq("assessment_id", asm!.id)
    .order("name");
  const locked = !!asm!.locked_at;

  return (
    <>
      <p className="sub"><Link href={`/sites/${siteId}`}>← Site</Link></p>
      <h1>Assessment report details</h1>
      <p className="sub">
        The limiting conditions (Req. 48) and the personnel table (Req. 51) are separate sections of the report. Both must be complete before the lead assessor can sign.
      </p>
      <Flash error={error} ok={ok} />
      {locked && <div className="flash error">This assessment is signed and locked. A licensee admin can reopen it from the Sign-off page.</div>}

      <form action={saveReport} className="card">
        <input type="hidden" name="site_id" value={siteId} />
        <fieldset disabled={locked} style={{ border: 0, padding: 0, margin: 0 }}>
          <label htmlFor="assessment_date">Date of the site-specific liability assessment report</label>
          <input id="assessment_date" name="assessment_date" type="date" defaultValue={asm!.assessment_date ?? ""} />
          <label htmlFor="limitations_text">
            Deviations from the standard and conditions that limit the scope of the assessment or the accuracy of the estimate (Req. 48): availability of historical information or people who know the site, snow cover, access to the subsurface. If there are none, say so.
          </label>
          <textarea id="limitations_text" name="limitations_text" rows={7} defaultValue={asm!.limitations_text ?? ""} />
          <p><button type="submit">Save</button></p>
        </fieldset>
      </form>

      <h2 id="personnel">Personnel (Req. 51)</h2>
      <p className="sub">Everyone involved in the assessment: their specific role, technical training, and previous experience conducting assessments and developing cost estimates (Req. 50-52).</p>
      {(people ?? []).length === 0 ? <p className="sub">No one recorded yet.</p> : (
        <div className="scroll">
          <table>
            <thead><tr><th>Name</th><th>Role</th><th>Technical training</th><th>Experience</th><th /></tr></thead>
            <tbody>
              {(people ?? []).map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td><td>{p.role}</td><td>{p.technical_training}</td><td>{p.experience}</td>
                  <td>
                    {!locked && (
                      <form action={deletePersonnel}>
                        <input type="hidden" name="site_id" value={siteId} />
                        <input type="hidden" name="id" value={p.id} />
                        <button className="secondary" type="submit">Remove</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!locked && (
        <form action={addPersonnel} className="card">
          <input type="hidden" name="site_id" value={siteId} />
          <div className="row">
            <div><label htmlFor="pn">Name</label><input id="pn" name="name" required /></div>
            <div><label htmlFor="pr">Role in this assessment</label><input id="pr" name="role" required /></div>
          </div>
          <label htmlFor="pt">Technical training</label>
          <input id="pt" name="technical_training" />
          <label htmlFor="pe">Previous experience (assessments and cost estimates)</label>
          <input id="pe" name="experience" />
          <p><button type="submit">Add person</button></p>
        </form>
      )}
    </>
  );
}
