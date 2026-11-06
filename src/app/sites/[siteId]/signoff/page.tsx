import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Flash } from "@/components/ui";
import { requireSiteAccess, seesAll } from "@/lib/db/access";
import { loadExportData, signoffProblems } from "@/lib/export/data";
import { STATEMENT_TEXT, STATEMENT_TEXT_VERSION } from "@/lib/signoff/checks";
import { OFFICER_STATEMENT } from "@/lib/declaration";
import { formatCad } from "@/lib/money";
import { uploadDocument } from "../../../actions/files";
import { reopenAssessment, signStatement } from "../../../actions/phase2";
import { signLiabilityDeclaration } from "../../../actions/phase3";

const STATEMENTS = [
  { id: "care_susp_aband", title: "Reasonable Care and Measures, Suspension, and Abandonment" },
  { id: "remediation_reclamation", title: "Remediation and Surface Land Reclamation" },
] as const;

export default async function SignoffPage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { siteId } = await params;
  const { error, ok } = await searchParams;
  const a = await requireSiteAccess(siteId);
  if (!seesAll(a)) notFound();

  const d = await loadExportData(siteId);
  const { data: creds } = await a.supabase
    .from("assessor_credentials")
    .select("association, registration_no, good_standing_attested_at")
    .eq("user_id", a.userId);
  // acknowledgements are only "ticked" at the moment of signing; here we list what is outstanding apart from them
  const problems = signoffProblems(d, creds ?? [], { req54: true, req56: true, req57: true });
  const locked = d.bundle.signoffs.care_susp_aband && d.bundle.signoffs.remediation_reclamation;

  return (
    <>
      <p className="sub"><Link href={`/sites/${siteId}`}>← Site</Link></p>
      <h1>Lead assessor sign-off</h1>
      <p className="sub">
        The lead assessor supervises and signs the assessment (Req. 52-57). Signing records your credentials and the statement wording version ({STATEMENT_TEXT_VERSION}); once both statements are signed the assessment is locked.
        This app does not apply a professional stamp or seal. Apply yours to the report and the acknowledgement statements before submission (Req. 54, 55).
      </p>
      <Flash error={error} ok={ok} />

      <h2>Status</h2>
      <div className="card">
        {STATEMENTS.map((s) => {
          const info = d.signoffInfo[s.id];
          return (
            <p key={s.id} style={{ margin: "6px 0" }}>
              {info ? <Badge tone="green">Signed</Badge> : <Badge tone="amber">Not signed</Badge>}{" "}
              <strong>{s.title}</strong>
              {info && <span className="sub"> · {info.name}, {info.credentials}, {info.signedOn}</span>}
            </p>
          );
        })}
      </div>

      <h2>Before signing</h2>
      {problems.length === 0 ? <p><Badge tone="green">Nothing outstanding</Badge></p> : problems.map((p, i) => (
        <div key={i} className="issue block"><small>{p.req} · {p.ruleId}</small><div>{p.message}</div></div>
      ))}
      <p className="sub">
        <Link href={`/sites/${siteId}/report`}>Report details and personnel</Link> · <Link href="/account/credentials">My professional credentials</Link>
      </p>

      {a.isAssessor && !locked && (
        <form action={signStatement} className="card">
          <input type="hidden" name="site_id" value={siteId} />
          <h2 style={{ marginTop: 0 }}>Sign</h2>
          <label className="inline"><input type="checkbox" name="req54" /> {STATEMENT_TEXT.req54} (Req. 54)</label>
          <label className="inline"><input type="checkbox" name="req56" /> {STATEMENT_TEXT.req56} (Req. 56)</label>
          <label className="inline"><input type="checkbox" name="req57" /> {STATEMENT_TEXT.req57} (Req. 57)</label>
          <label htmlFor="statement">Acknowledgement statement to sign</label>
          <select id="statement" name="statement" required defaultValue="">
            <option value="" disabled>Choose…</option>
            {STATEMENTS.filter((s) => !d.signoffInfo[s.id]).map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
          <p><button type="submit">Sign statement</button></p>
        </form>
      )}
      {!a.isAssessor && <p className="sub">Only the site&apos;s lead assessor can sign.</p>}

      {/* ------------------------------------------------ senior officer e-signature on F035 */}
      <h2 id="officer">Liability Declaration: senior officer&apos;s signature</h2>
      {(() => {
        const o = d.bundle.officer;
        const f = o.figures;
        return (
          <div className="card">
            <p style={{ marginTop: 0 }}>
              {o.state === "valid" && <Badge tone="green">Signed</Badge>}
              {o.state === "stale" && <Badge tone="red">Figures changed since signing</Badge>}
              {o.state === "none" && <Badge tone="amber">Not signed</Badge>}{" "}
              {o.latest && (
                <span className="sub">
                  {o.latest.signer_name}, {o.latest.signer_position}, {new Date(o.latest.signed_at).toLocaleString("en-CA")}
                </span>
              )}
            </p>
            <table>
              <tbody>
                <tr><td>Suspension and abandonment</td><td className="num">{formatCad(f.suspensionAbandonmentCents)}</td></tr>
                <tr><td>Remediation</td><td className="num">{formatCad(f.remediationCents)}</td></tr>
                <tr><td>Surface reclamation</td><td className="num">{formatCad(f.reclamationCents)}</td></tr>
                <tr><td><strong>Total estimate</strong></td><td className="num"><strong>{formatCad(f.totalCents)}</strong></td></tr>
              </tbody>
            </table>
            <p className="sub">
              The signature is tied to these exact figures, the licence, the licensee and the assessment date. If any of them change after signing, it is marked stale and must be signed again.
              Whether the AER accepts an electronic signature on F035 is for you to confirm; if it does not, print the form from the export page and sign it by hand.
            </p>
            {a.isLicenseeAdmin && locked && o.state !== "valid" && (
              <form action={signLiabilityDeclaration}>
                <input type="hidden" name="site_id" value={siteId} />
                <label className="inline"><input type="checkbox" name="attest" /> {OFFICER_STATEMENT}</label>
                <div className="row">
                  <div><label htmlFor="o-name">Full name</label><input id="o-name" name="name" required autoComplete="name" /></div>
                  <div><label htmlFor="o-pos">Position and professional designations</label><input id="o-pos" name="position" required /></div>
                  <div><label htmlFor="o-typed">Type your full name again to sign</label><input id="o-typed" name="typed" required autoComplete="off" /></div>
                </div>
                <p><button type="submit">{o.state === "stale" ? "Sign again" : "Sign the Liability Declaration"}</button></p>
              </form>
            )}
            {a.isLicenseeAdmin && !locked && <p className="sub">Available after the lead assessor has signed both acknowledgement statements.</p>}
            {!a.isLicenseeAdmin && <p className="sub">A licensee admin signs on behalf of the senior corporate officer or director.</p>}
          </div>
        );
      })()}

      {/* ------------------------------------------------ stamped / signed pages */}
      <h2>Stamped and signed pages</h2>
      <p className="sub">
        Req. 54 and 55 expect the lead assessor&apos;s professional seal or stamp and signature on the report. Upload the stamped, signed pages here; they go into the package&apos;s forms folder.
      </p>
      {(a.isAssessor || a.isLicenseeMember) && (
        <form action={uploadDocument} className="card">
          <input type="hidden" name="site_id" value={siteId} />
          <input type="hidden" name="kind" value="signed_forms" />
          <div className="row">
            <div><label htmlFor="sf-title">Title</label><input id="sf-title" name="title" placeholder="Stamped acknowledgement statements" /></div>
            <div><label htmlFor="sf-file">File</label><input id="sf-file" name="file" type="file" required /></div>
          </div>
          <p><button type="submit">Upload</button> {d.bundle.documents.some((x) => x.kind === "signed_forms") && <Badge tone="green">uploaded</Badge>}</p>
        </form>
      )}

      {a.isLicenseeAdmin && (d.signoffInfo.care_susp_aband || d.signoffInfo.remediation_reclamation) && (
        <form action={reopenAssessment} className="card">
          <input type="hidden" name="site_id" value={siteId} />
          <input type="hidden" name="assessment_id" value={d.bundle.assessment.id} />
          <p>Reopening clears both sign-offs and unlocks the assessment so it can be changed. The audit log keeps the removed sign-offs.</p>
          <button className="danger" type="submit">Reopen assessment</button>
        </form>
      )}
    </>
  );
}
