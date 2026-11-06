import { UploadForm } from "@/components/UploadForm";
import { Badge, Flash } from "@/components/ui";
import { requireMembership } from "@/lib/db/access";
import { applyLibrarySheet, deleteLibrarySheet, uploadLibrarySheet } from "../actions/phase3";

const DISCOUNT_LABEL: Record<string, string> = {
  none: "No discount (published rates)",
  available_to_all: "Discount available to all parties",
  client_specific: "Client-specific discount",
  multi_site: "Multi-site / coordinated-cleanup discount",
};

type Entry = {
  id: string; org_id: string; vendor: string | null; title: string; effective_date: string | null;
  discount_type: string; notes: string | null; created_at: string;
};

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const { error, ok } = await searchParams;
  const { supabase, memberships } = await requireMembership();
  const { data } = await supabase.from("rate_library").select("*").order("title");
  const entries = (data ?? []) as Entry[];
  const { data: sites } = await supabase.from("sites").select("id, site_name, licence_no").order("site_name");
  const orgName = new Map(memberships.map((m) => [m.org.id, m.org.name]));
  const stale = new Date();
  stale.setUTCFullYear(stale.getUTCFullYear() - 1);

  return (
    <>
      <h1>Rate library</h1>
      <p className="sub">
        Keep your organization&apos;s third-party rate sheets here once and use them on any site you have access to. Using one copies the file into the site, so each submission package stays self-contained and the rates it cites can&apos;t change later (Req. 3, 58(j)).
        Rates must be current-day, so replace a sheet when a newer one is published. Only members of your organization can see this library.
      </p>
      <Flash error={error} ok={ok} />

      {entries.length === 0 ? <p className="sub">Nothing in the library yet.</p> : (
        <div className="scroll">
          <table>
            <thead><tr><th>Rate sheet</th><th>Organization</th><th>Effective</th><th>Discounts</th><th>Use on a site</th><th /></tr></thead>
            <tbody>
              {entries.map((e) => {
                const old = e.effective_date ? new Date(e.effective_date) < stale : true;
                return (
                  <tr key={e.id}>
                    <td>{e.title}{e.vendor ? <span className="sub"> · {e.vendor}</span> : null}{e.notes ? <div className="sub">{e.notes}</div> : null}</td>
                    <td>{orgName.get(e.org_id) ?? ""}</td>
                    <td>{e.effective_date ?? "undated"} {old && <Badge tone="amber">{e.effective_date ? "over 12 months old" : "no date"}</Badge>}</td>
                    <td>{DISCOUNT_LABEL[e.discount_type]}</td>
                    <td>
                      {(sites ?? []).length > 0 && (
                        <form action={applyLibrarySheet} style={{ display: "flex", gap: 6 }}>
                          <input type="hidden" name="library_id" value={e.id} />
                          <select name="site_id" required defaultValue="" aria-label={`Use ${e.title} on a site`}>
                            <option value="" disabled>Choose site…</option>
                            {(sites ?? []).map((s) => <option key={s.id} value={s.id}>{s.site_name || s.licence_no || s.id}</option>)}
                          </select>
                          <button type="submit">Use</button>
                        </form>
                      )}
                    </td>
                    <td>
                      <form action={deleteLibrarySheet}>
                        <input type="hidden" name="id" value={e.id} />
                        <button className="secondary" type="submit">Delete</button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <h2>Add to the library</h2>
      <UploadForm action={uploadLibrarySheet} purpose="library" submitLabel="Add">
        {memberships.length > 1 ? (
          <>
            <label htmlFor="org_id">Organization</label>
            <select id="org_id" name="org_id" required>
              {memberships.map((m) => <option key={m.org.id} value={m.org.id}>{m.org.name}</option>)}
            </select>
          </>
        ) : (
          <input type="hidden" name="org_id" value={memberships[0]!.org.id} />
        )}
        <div className="row">
          <div><label htmlFor="title">Title</label><input id="title" name="title" required /></div>
          <div><label htmlFor="vendor">Vendor / publisher</label><input id="vendor" name="vendor" /></div>
          <div><label htmlFor="effective_date">Effective date</label><input id="effective_date" name="effective_date" type="date" /></div>
        </div>
        <label htmlFor="discount_type">Discounts in these rates</label>
        <select id="discount_type" name="discount_type" defaultValue="none">
          {Object.entries(DISCOUNT_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <label htmlFor="notes">Notes (optional)</label>
        <input id="notes" name="notes" />
        <label htmlFor="file">File (PDF, Word, Excel, CSV or image; up to 25 MB)</label>
        <input id="file" name="file" type="file" required />
      </UploadForm>
    </>
  );
}
