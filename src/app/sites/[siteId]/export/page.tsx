import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Flash } from "@/components/ui";
import { requireSiteAccess, seesAll } from "@/lib/db/access";
import { loadExportData, packageProblems } from "@/lib/export/data";
import { formatCad } from "@/lib/money";
import { summarizeCosts } from "@/lib/costs";
import { buildPackage } from "../../../actions/phase2";

// Building the package fills four templates and downloads every uploaded file: allow a longer run on Vercel.
export const maxDuration = 60;

export default async function ExportPage({
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
  const problems = packageProblems(d);
  const signed = d.bundle.signoffs.care_susp_aband && d.bundle.signoffs.remediation_reclamation;
  const cost = summarizeCosts(d.bundle.ctx);

  const { data: exports } = await a.supabase
    .from("package_exports")
    .select("id, storage_path, manifest, generated_at")
    .eq("assessment_id", d.bundle.assessment.id)
    .order("generated_at", { ascending: false });

  const downloads = [
    ["cost-forms", "Forms 001-A and 001-B (Excel)", `Remediation and reclamation total ${formatCad(cost.byForm["001-B"])}; care, suspension and abandonment ${formatCad(cost.byForm["001-A"])}`],
    ["liability-declaration", "Liability Declaration F035 (PDF)", "Filled except the senior officer's signature, position and date"],
    ["acknowledgements", "Acknowledgement Statements (Word)", "Boxes are ticked only for statements the lead assessor has signed"],
    ["schedule", "Itemized cost schedule (Excel)", "Every line with its rate source; contingencies stay separate"],
  ] as const;

  return (
    <>
      <p className="sub"><Link href={`/sites/${siteId}`}>← Site</Link></p>
      <h1>Forms and submission package</h1>
      <p className="sub">
        The package is what you email to <strong>ssla@aer.ca</strong> (Req. 58). The forms below are the AER&apos;s own templates, filled in. They are marked DRAFT until both acknowledgement statements are signed.
      </p>
      <Flash error={error} ok={ok} />

      <h2>Individual files {signed ? "" : <Badge tone="amber">draft</Badge>}</h2>
      <div className="card">
        <table>
          <tbody>
            {downloads.map(([file, title, note]) => (
              <tr key={file}>
                <td><a href={`/sites/${siteId}/export/${file}`}>{title}</a></td>
                <td className="sub">{note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Submission package</h2>
      {problems.length === 0 ? (
        <p><Badge tone="green">Ready to build</Badge></p>
      ) : (
        <>
          <p><Badge tone="red">Not ready</Badge> Fix these first:</p>
          {problems.map((p, i) => (
            <div key={i} className={`issue ${p.ruleId === "V-25" ? "block" : "warn"}`}>
              <small>{p.req}{p.ruleId === "V-25" ? " · V-25" : ""}</small>
              <div>{p.message}</div>
            </div>
          ))}
        </>
      )}
      {a.isLicenseeAdmin ? (
        <form action={buildPackage}>
          <input type="hidden" name="site_id" value={siteId} />
          <p><button type="submit" disabled={problems.length > 0}>Build package (zip)</button></p>
        </form>
      ) : (
        <p className="sub">A licensee admin builds the package.</p>
      )}

      <h2>Built packages</h2>
      {(exports ?? []).length === 0 ? <p className="sub">None yet.</p> : (
        <table>
          <thead><tr><th>Built</th><th>Files</th><th /></tr></thead>
          <tbody>
            {(exports ?? []).map((e) => (
              <tr key={e.id}>
                <td>{new Date(e.generated_at).toLocaleString("en-CA")}</td>
                <td>{(e.manifest as { files?: unknown[] })?.files?.length ?? "?"}</td>
                <td><a href={`/sites/${siteId}/files/package_exports/${e.id}`}>Download zip</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Before you send it</h2>
      <ol>
        <li>A senior corporate officer or director signs the Liability Declaration (F035).</li>
        <li>The lead assessor applies their professional stamp or seal and signature to the report and acknowledgement statements (Req. 54, 55). This app records the sign-off but does not apply a stamp.</li>
        <li>Enter the cost estimate in the AER&apos;s designated information submission system (Req. 58(k)), then record it on the site page.</li>
        <li>Email the package to ssla@aer.ca.</li>
      </ol>
    </>
  );
}
