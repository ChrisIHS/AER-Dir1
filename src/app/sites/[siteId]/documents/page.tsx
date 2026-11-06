import Link from "next/link";
import { FileLink, Flash } from "@/components/ui";
import { requireSiteAccess } from "@/lib/db/access";
import type { DocumentRow } from "@/lib/db/types";
import { WORKSTREAM_KINDS } from "@/lib/validation/types";
import { DOC_KIND_LABEL } from "@/lib/workstreams/labels";
import { WORKSTREAM_META } from "@/lib/workstreams/meta";
import { deleteFile, uploadDocument } from "../../../actions/files";

export default async function DocumentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { siteId } = await params;
  const { error, ok } = await searchParams;
  const a = await requireSiteAccess(siteId);
  const { data } = await a.supabase.from("documents").select("*").eq("site_id", siteId).order("created_at");
  const docs = (data ?? []) as DocumentRow[];

  // Workstreams this user can attach files to (RLS limits contractors to their own).
  const { data: asm } = await a.supabase.from("assessments").select("id").eq("site_id", siteId).order("version_no", { ascending: false }).limit(1).maybeSingle();
  const { data: wsRows } = asm
    ? await a.supabase.from("workstreams").select("id, kind").eq("assessment_id", asm.id)
    : { data: [] as { id: string; kind: string }[] };
  const wsKind = new Map((wsRows ?? []).map((w) => [w.id as string, w.kind as string]));
  const attachable = WORKSTREAM_KINDS.flatMap((k) => (wsRows ?? []).filter((w) => w.kind === k));
  const siteLevelAllowed = a.isLicenseeMember || a.isAssessor;

  return (
    <>
      <p className="sub"><Link href={`/sites/${siteId}`}>← Site</Link></p>
      <h1>Documents</h1>
      <p className="sub">
        Plans, supporting information and the site drawing. Do not upload remedial action plans or contamination management reports: cite their OneStop submission IDs on the ESA workstream instead (Req. 17).
      </p>
      <Flash error={error} ok={ok} />

      {docs.length === 0 ? <p className="sub">No documents you can see yet.</p> : (
        <div className="scroll">
          <table>
            <thead><tr><th>Document</th><th>Type</th><th>Workstream</th><th /></tr></thead>
            <tbody>
              {docs.map((d) => {
                const k = d.workstream_id ? wsKind.get(d.workstream_id) : null;
                return (
                  <tr key={d.id}>
                    <td><FileLink siteId={siteId} table="documents" id={d.id}>{d.title}</FileLink></td>
                    <td>{DOC_KIND_LABEL[d.kind] ?? d.kind}</td>
                    <td>{k ? WORKSTREAM_META[k as keyof typeof WORKSTREAM_META].title : "Whole site"}</td>
                    <td>
                      {a.memberOrgIds.includes(d.uploaded_by_org) || a.isLicenseeAdmin ? (
                        <form action={deleteFile}>
                          <input type="hidden" name="site_id" value={siteId} />
                          <input type="hidden" name="table" value="documents" />
                          <input type="hidden" name="id" value={d.id} />
                          <button className="secondary" type="submit">Delete</button>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <h2>Upload a document</h2>
      <form action={uploadDocument} className="card">
        <input type="hidden" name="site_id" value={siteId} />
        <div className="row">
          <div>
            <label htmlFor="kind">Type</label>
            <select id="kind" name="kind" required defaultValue="">
              <option value="" disabled>Choose…</option>
              {Object.entries(DOC_KIND_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="workstream_id">Attach to workstream</label>
            <select id="workstream_id" name="workstream_id" defaultValue={siteLevelAllowed ? "" : (attachable[0]?.id ?? "")}>
              {siteLevelAllowed && <option value="">Whole site</option>}
              {attachable.map((w) => <option key={w.id} value={w.id}>{WORKSTREAM_META[w.kind as keyof typeof WORKSTREAM_META].title}</option>)}
            </select>
          </div>
          <div><label htmlFor="title">Title (optional)</label><input id="title" name="title" /></div>
        </div>
        <label htmlFor="file">File (PDF, Word, Excel, CSV or image; up to 25 MB)</label>
        <input id="file" name="file" type="file" required />
        <p><button type="submit">Upload</button></p>
      </form>
    </>
  );
}
