import { UploadForm } from "@/components/UploadForm";
import Link from "next/link";
import { FileLink, Flash } from "@/components/ui";
import { requireSiteAccess } from "@/lib/db/access";
import type { RateSheetRow } from "@/lib/db/types";
import { deleteFile, uploadRateSheet } from "../../../actions/files";
import { applyLibrarySheet } from "../../../actions/phase3";

const DISCOUNT_LABEL: Record<string, string> = {
  none: "No discount (published rates)",
  available_to_all: "Discount available to all parties",
  client_specific: "Client-specific discount",
  multi_site: "Multi-site / coordinated-cleanup discount",
};

export default async function RateSheetsPage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { siteId } = await params;
  const { error, ok } = await searchParams;
  const a = await requireSiteAccess(siteId);
  const { data } = await a.supabase.from("rate_sheets").select("*").eq("site_id", siteId).order("created_at");
  const sheets = (data ?? []) as RateSheetRow[];
  const { data: library } = await a.supabase.from("rate_library").select("id, title, vendor, effective_date").order("title");

  return (
    <>
      <p className="sub"><Link href={`/sites/${siteId}`}>← Site</Link></p>
      <h1>Third-party rate sheets</h1>
      <p className="sub">
        Every unit rate must come from an undiscounted, current-day, third-party published rate sheet uploaded here, and all of them go to the AER (Req. 3, 58(j)).
        Client-specific and multi-site discounts may not be applied; mark them honestly and the checks will flag any line that uses such a sheet.
      </p>
      <Flash error={error} ok={ok} />

      {sheets.length === 0 ? <p className="sub">No rate sheets you can see yet.</p> : (
        <div className="scroll">
          <table>
            <thead><tr><th>Title</th><th>Vendor</th><th>Effective</th><th>Discount</th><th>Shared</th><th /></tr></thead>
            <tbody>
              {sheets.map((r) => (
                <tr key={r.id}>
                  <td><FileLink siteId={siteId} table="rate_sheets" id={r.id}>{r.title}</FileLink></td>
                  <td>{r.vendor ?? ""}</td>
                  <td>{r.effective_date ?? <span className="sub">undated</span>}</td>
                  <td>{DISCOUNT_LABEL[r.discount_type]}</td>
                  <td>{r.shared ? "Yes" : ""}</td>
                  <td>
                    {a.memberOrgIds.includes(r.uploaded_by_org) || a.isLicenseeAdmin ? (
                      <form action={deleteFile}>
                        <input type="hidden" name="site_id" value={siteId} />
                        <input type="hidden" name="table" value="rate_sheets" />
                        <input type="hidden" name="id" value={r.id} />
                        <button className="secondary" type="submit">Delete</button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(library ?? []).length > 0 && (
        <>
          <h2>Use a sheet from your library</h2>
          <form action={applyLibrarySheet} className="card" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
            <input type="hidden" name="site_id" value={siteId} />
            <div style={{ flex: "1 1 320px" }}>
              <label htmlFor="library_id">Rate library</label>
              <select id="library_id" name="library_id" required defaultValue="">
                <option value="" disabled>Choose…</option>
                {(library ?? []).map((l) => (
                  <option key={l.id} value={l.id}>{l.title}{l.effective_date ? ` (${l.effective_date})` : " (undated)"}</option>
                ))}
              </select>
            </div>
            <button type="submit">Use on this site</button>
          </form>
        </>
      )}
      <p className="sub">Manage your reusable sheets in the <Link href="/library">rate library</Link>.</p>

      <h2>Upload a rate sheet</h2>
      <UploadForm action={uploadRateSheet} purpose="rate_sheet" siteId={siteId} submitLabel="Upload">
        <input type="hidden" name="site_id" value={siteId} />
        <div className="row">
          <div><label htmlFor="title">Title</label><input id="title" name="title" required /></div>
          <div><label htmlFor="vendor">Vendor / publisher</label><input id="vendor" name="vendor" /></div>
          <div><label htmlFor="effective_date">Effective date</label><input id="effective_date" name="effective_date" type="date" /></div>
        </div>
        <label htmlFor="discount_type">Discounts in these rates</label>
        <select id="discount_type" name="discount_type" defaultValue="none">
          {Object.entries(DISCOUNT_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        {a.isLicenseeMember && (
          <label className="inline"><input type="checkbox" name="shared" /> Let all contractors on this site use this rate sheet</label>
        )}
        <label htmlFor="file">File (PDF, Word, Excel, CSV or image; up to 25 MB)</label>
        <input id="file" name="file" type="file" required />
      </UploadForm>
    </>
  );
}
