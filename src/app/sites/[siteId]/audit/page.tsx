import Link from "next/link";
import { notFound } from "next/navigation";
import { AUDIT_TABLES, describeChange } from "@/lib/audit";
import { requireSiteAccess } from "@/lib/db/access";

type AuditRow = {
  id: number;
  at: string;
  actor: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
};

export default async function AuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string }>;
  searchParams: Promise<{ table?: string; actor?: string; from?: string; to?: string }>;
}) {
  const { siteId } = await params;
  const f = await searchParams;
  const a = await requireSiteAccess(siteId);
  if (!a.isLicenseeAdmin && !a.isAssessor) notFound();

  let q = a.supabase
    .from("audit_log")
    .select("id, at, actor, action, table_name, record_id, before, after")
    .eq("site_id", siteId)
    .order("id", { ascending: false })
    .limit(300);
  if (f.table && (AUDIT_TABLES as readonly string[]).includes(f.table)) q = q.eq("table_name", f.table);
  if (f.actor) q = q.eq("actor", f.actor);
  if (f.from) q = q.gte("at", `${f.from}T00:00:00`);
  if (f.to) q = q.lte("at", `${f.to}T23:59:59`);
  const { data } = await q;
  const rows = (data ?? []) as AuditRow[];

  const actorIds = [...new Set(rows.map((r) => r.actor).filter((x): x is string => !!x))];
  const { data: profs } = actorIds.length
    ? await a.supabase.from("profiles").select("user_id, full_name, email").in("user_id", actorIds)
    : { data: [] as { user_id: string; full_name: string | null; email: string | null }[] };
  const name = new Map((profs ?? []).map((p) => [p.user_id, p.full_name || p.email || p.user_id]));

  return (
    <>
      <p className="sub"><Link href={`/sites/${siteId}`}>← Site</Link></p>
      <h1>Audit log</h1>
      <p className="sub">Every change to this site, written by the database itself: who, what, when. Rows cannot be edited or deleted. Showing the latest 300 matching changes.</p>

      <form method="get" className="card">
        <div className="row">
          <div>
            <label htmlFor="table">Record type</label>
            <select id="table" name="table" defaultValue={f.table ?? ""}>
              <option value="">All</option>
              {AUDIT_TABLES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="actor">Changed by</label>
            <select id="actor" name="actor" defaultValue={f.actor ?? ""}>
              <option value="">Anyone</option>
              {[...name.entries()].map(([id, n]) => <option key={id} value={id}>{n}</option>)}
            </select>
          </div>
          <div><label htmlFor="from">From</label><input id="from" name="from" type="date" defaultValue={f.from ?? ""} /></div>
          <div><label htmlFor="to">To</label><input id="to" name="to" type="date" defaultValue={f.to ?? ""} /></div>
        </div>
        <p><button type="submit">Filter</button> <Link className="btn secondary" href={`/sites/${siteId}/audit`}>Clear</Link></p>
      </form>

      <div className="scroll">
        <table>
          <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Record</th><th>What changed</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="mono">{new Date(r.at).toLocaleString("en-CA")}</td>
                <td>{r.actor ? (name.get(r.actor) ?? r.actor) : <span className="sub">system</span>}</td>
                <td>{r.action.toLowerCase()}</td>
                <td>{r.table_name.replace(/_/g, " ")}</td>
                <td>{describeChange(r.action, r.before, r.after)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && <p className="sub">No changes match.</p>}
    </>
  );
}
