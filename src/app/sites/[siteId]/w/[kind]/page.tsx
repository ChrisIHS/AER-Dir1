import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Flash, IssueList } from "@/components/ui";
import { requireSiteAccess } from "@/lib/db/access";
import { loadSiteBundle } from "@/lib/db/load";
import type { DocumentRow, LineItemRow, RateSheetRow } from "@/lib/db/types";
import { FORM_ROWS } from "@/lib/forms/templateMap";
import { formatCad, toCents } from "@/lib/money";
import { validate } from "@/lib/validation/engine";
import { WORKSTREAM_KINDS, type WorkstreamKind } from "@/lib/validation/types";
import { REQ_5_ITEMS, REQ_5_LABELS } from "@/lib/workstreams/details";
import { apecsToText, DETAIL_FIELDS, getAt, segmentsToText, type FieldSpec } from "@/lib/workstreams/fields";
import { BLOCK_TITLE, CONTINGENCY_LABEL, COST_CATEGORY_LABEL } from "@/lib/workstreams/labels";
import { STATUS_LABEL, STATUS_TONE, WORKSTREAM_META } from "@/lib/workstreams/meta";
import { deleteLine, saveDetails, saveLine, transition } from "../../../../actions/workstream";
import { addComment, setCommentResolved } from "../../../../actions/phase2";

const OPEN = new Set(["not_started", "in_progress", "changes_requested"]);

export default async function WorkstreamPage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string; kind: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { siteId, kind: kindParam } = await params;
  const { error, ok } = await searchParams;
  const kind = WORKSTREAM_KINDS.find((k) => k === kindParam);
  if (!kind) notFound();

  const a = await requireSiteAccess(siteId);
  const bundle = await loadSiteBundle(siteId);
  const ws = bundle.workstreams[kind];

  // RLS decides whether this user may see the workstream at all.
  const { data: visible } = await a.supabase.from("workstreams").select("id").eq("id", ws.id).maybeSingle();
  if (!visible) notFound();

  const [linesRes, detailsRes, sheetsRes, docsRes, commentsRes] = await Promise.all([
    a.supabase.from("cost_line_items").select("*").eq("workstream_id", ws.id).order("sort_order").order("created_at"),
    a.supabase.from("workstream_details").select("data").eq("workstream_id", ws.id).maybeSingle(),
    a.supabase.from("rate_sheets").select("*").eq("site_id", siteId).order("title"),
    a.supabase.from("documents").select("*").eq("site_id", siteId).order("title"),
    a.supabase.from("comments").select("id, author_id, body, resolved_at, created_at").eq("workstream_id", ws.id).order("created_at"),
  ]);
  const comments = commentsRes.data ?? [];
  const authorIds = [...new Set(comments.map((c) => c.author_id as string))];
  const { data: authors } = authorIds.length
    ? await a.supabase.from("profiles").select("user_id, full_name, email").in("user_id", authorIds)
    : { data: [] as { user_id: string; full_name: string | null; email: string | null }[] };
  const authorName = new Map((authors ?? []).map((p) => [p.user_id, p.full_name || p.email || "Unknown"]));
  const lines = (linesRes.data ?? []) as LineItemRow[];
  const details = detailsRes.data?.data ?? {};
  const sheets = (sheetsRes.data ?? []) as RateSheetRow[];
  const docs = (docsRes.data ?? []) as DocumentRow[];

  const assignedToMe = bundle.assignments.some((x) => x.workstream_id === ws.id && a.contractorOrgIds.includes(x.org_id));
  const canEdit = OPEN.has(ws.status) && (a.isLicenseeMember || assignedToMe);
  const canReview = a.isLicenseeAdmin || a.isAssessor;

  const issues = validate(bundle.ctx).filter((i) => i.workstream === kind);
  const meta = WORKSTREAM_META[kind];
  const totalCents = lines.reduce((t, l) => t + toCents(l.total), 0);
  const hidden = (
    <>
      <input type="hidden" name="site_id" value={siteId} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="workstream_id" value={ws.id} />
    </>
  );

  return (
    <>
      <p className="sub"><Link href={`/sites/${siteId}`}>← Site</Link></p>
      <h1>{meta.title}</h1>
      <p className="sub">
        {meta.reqs} · <Badge tone={STATUS_TONE[ws.status]!}>{STATUS_LABEL[ws.status]}</Badge>
        {" "}· Assigned to: {bundle.owners.workstream[kind] ?? "nobody yet"} · Subtotal {formatCad(totalCents)}
      </p>
      <p>{meta.blurb}</p>
      <Flash error={error} ok={ok} />

      {/* ---------------------------------------------------------- status actions */}
      <div className="card">
        <div className="row" style={{ alignItems: "flex-end" }}>
          {canEdit && (ws.status === "in_progress" || ws.status === "changes_requested" || ws.status === "not_started") && (
            <form action={transition}>
              {hidden}
              <input type="hidden" name="action" value="submit" />
              <button type="submit">Submit for review</button>
              <span className="sub"> Blocked while any issue below says &ldquo;Blocks submission&rdquo;.</span>
            </form>
          )}
          {canReview && (ws.status === "submitted" || ws.status === "approved") && (
            <form action={transition}>
              {hidden}
              <input type="hidden" name="action" value="return" />
              <label htmlFor="reason">Reason for returning (required)</label>
              <input id="reason" name="reason" required />
              <p><button className="secondary" type="submit">Return for changes</button></p>
            </form>
          )}
          {a.isLicenseeAdmin && ws.status === "submitted" && (
            <form action={transition}>
              {hidden}
              <input type="hidden" name="action" value="approve" />
              <button type="submit">Approve</button>
            </form>
          )}
        </div>
        {!canEdit && (ws.status === "submitted" || ws.status === "approved") && (
          <p className="sub">This workstream is locked while {ws.status === "submitted" ? "it is under review" : "approved"}. A reviewer can return it for changes.</p>
        )}
        {!canEdit && OPEN.has(ws.status) && <p className="sub">You have read-only access to this workstream.</p>}
      </div>

      {/* ---------------------------------------------------------- issues */}
      <h2>Issues</h2>
      <IssueList issues={issues} empty="No issues. This workstream passes every check that applies to it." />

      {/* ---------------------------------------------------------- comments */}
      <h2 id="comments">Comments</h2>
      {comments.length === 0 && <p className="sub">No comments yet.</p>}
      {comments.map((c) => (
        <div key={c.id} className="card" style={c.resolved_at ? { opacity: 0.65 } : undefined}>
          <small className="sub">
            {authorName.get(c.author_id as string) ?? "Unknown"} · {new Date(c.created_at as string).toLocaleString("en-CA")}
            {c.resolved_at ? " · resolved" : ""}
          </small>
          <div style={{ whiteSpace: "pre-wrap" }}>{c.body}</div>
          {(canReview || a.isLicenseeMember || c.author_id === a.userId) && (
            <form action={setCommentResolved}>
              {hidden}
              <input type="hidden" name="comment_id" value={c.id} />
              <input type="hidden" name="resolved" value={c.resolved_at ? "0" : "1"} />
              <button className="secondary" type="submit">{c.resolved_at ? "Reopen" : "Mark resolved"}</button>
            </form>
          )}
        </div>
      ))}
      <form action={addComment} className="card">
        {hidden}
        <label htmlFor="body">Add a comment</label>
        <textarea id="body" name="body" required />
        <p><button type="submit">Post comment</button></p>
      </form>

      {/* ---------------------------------------------------------- details */}
      <h2>Details</h2>
      <form action={saveDetails} className="card">
        {hidden}
        <fieldset disabled={!canEdit} style={{ border: 0, padding: 0, margin: 0 }}>
          {kind !== "care_security" && (
            <>
              <input type="hidden" name="applicable_present" value="1" />
              <label className="inline">
                <input type="checkbox" name="applicable" defaultChecked={ws.applicable} /> This workstream applies to the site
              </label>
              <label htmlFor="na_rationale">If it does not apply, say why</label>
              <input id="na_rationale" name="na_rationale" defaultValue={ws.na_rationale ?? ""} />
            </>
          )}
          <DetailFields specs={DETAIL_FIELDS[kind]} data={details} docs={docs} />
        </fieldset>
        {canEdit && <p><button type="submit">Save details</button></p>}
      </form>

      {/* ---------------------------------------------------------- line items */}
      <h2 id="lines">Cost line items</h2>
      <p className="sub">
        Costs must be undiscounted, current-day, third-party rates (Req. 3, 4), itemized (Req. 2). Pick the AER form row each line is reported on; the totals are calculated by the database.
      </p>
      {lines.length === 0 && <p className="sub">No lines yet.</p>}
      {lines.map((l) => (
        <LineCard
          key={l.id}
          line={l}
          kind={kind}
          siteId={siteId}
          wsId={ws.id}
          sheets={sheets}
          docs={docs}
          canEdit={canEdit}
          issues={issues.filter((i) => i.lineItemId === l.id)}
        />
      ))}
      {canEdit && (
        <>
          <h3>Add a line</h3>
          <LineCard line={null} kind={kind} siteId={siteId} wsId={ws.id} sheets={sheets} docs={docs} canEdit issues={[]} />
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------- details fields
function DetailFields({ specs, data, docs }: { specs: FieldSpec[]; data: unknown; docs: DocumentRow[] }) {
  const groups: { name: string; specs: FieldSpec[] }[] = [];
  for (const s of specs) {
    const name = s.group ?? "";
    const g = groups.find((x) => x.name === name);
    if (g) g.specs.push(s);
    else groups.push({ name, specs: [s] });
  }
  return (
    <>
      {groups.map((g) => {
        const body = g.specs.map((s) => <Field key={s.path} spec={s} value={getAt(data, s.path)} docs={docs} />);
        return g.name ? (
          <fieldset key={g.name}>
            <legend>{g.name}</legend>
            {body}
          </fieldset>
        ) : (
          <div key="_">{body}</div>
        );
      })}
    </>
  );
}

function Field({ spec, value, docs }: { spec: FieldSpec; value: unknown; docs: DocumentRow[] }) {
  const id = `f-${spec.path}`;
  const label = (
    <>
      {spec.label}
      {spec.req ? <span className="sub"> ({spec.req})</span> : null}
    </>
  );
  switch (spec.type) {
    case "bool":
      return (
        <label className="inline">
          <input type="checkbox" name={spec.path} defaultChecked={value === true} /> <span>{label}</span>
        </label>
      );
    case "number":
      return (
        <>
          <label htmlFor={id}>{label}</label>
          <input id={id} name={spec.path} type="number" step="any" defaultValue={typeof value === "number" ? value : ""} />
        </>
      );
    case "textarea":
      return (
        <>
          <label htmlFor={id}>{label}</label>
          <textarea id={id} name={spec.path} defaultValue={typeof value === "string" ? value : ""} />
        </>
      );
    case "select":
      return (
        <>
          <label htmlFor={id}>{label}</label>
          <select id={id} name={spec.path} defaultValue={typeof value === "string" ? value : ""}>
            <option value="">Not decided</option>
            {spec.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </>
      );
    case "document":
      return (
        <>
          <label htmlFor={id}>{label}</label>
          <select id={id} name={spec.path} defaultValue={typeof value === "string" ? value : ""}>
            <option value="">None</option>
            {docs.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
          </select>
        </>
      );
    case "segments":
      return (
        <>
          <label htmlFor={id}>{label}</label>
          <textarea id={id} name={spec.path} defaultValue={Array.isArray(value) ? segmentsToText(value as never) : ""} />
          {spec.hint && <span className="sub">{spec.hint}</span>}
        </>
      );
    case "lines":
      return (
        <>
          <label htmlFor={id}>{label}</label>
          <textarea id={id} name={spec.path} defaultValue={Array.isArray(value) ? apecsToText(value as never) : ""} />
          {spec.hint && <span className="sub">{spec.hint}</span>}
        </>
      );
    case "multicheck": {
      const chosen = new Set(Array.isArray(value) ? (value as string[]) : []);
      return (
        <>
          <label>{label}</label>
          {spec.options?.map((o) => (
            <label key={o.value} className="inline">
              <input type="checkbox" name={spec.path} value={o.value} defaultChecked={chosen.has(o.value)} /> {o.label}
            </label>
          ))}
        </>
      );
    }
    default:
      return (
        <>
          <label htmlFor={id}>{label}</label>
          <input id={id} name={spec.path} defaultValue={typeof value === "string" ? value : ""} />
        </>
      );
  }
}

// ---------------------------------------------------------------- line item card
function LineCard({
  line, kind, siteId, wsId, sheets, docs, canEdit, issues,
}: {
  line: LineItemRow | null;
  kind: WorkstreamKind;
  siteId: string;
  wsId: string;
  sheets: RateSheetRow[];
  docs: DocumentRow[];
  canEdit: boolean;
  issues: import("@/lib/validation/types").Issue[];
}) {
  const pct = line?.calc_mode === "percent_of_base";
  const qty = line?.quantity === null || line?.quantity === undefined ? "" : pct ? Number(line.quantity) * 100 : Number(line.quantity);
  const rowsByBlock = new Map<string, typeof FORM_ROWS[number][]>();
  for (const r of FORM_ROWS) {
    const k = `${r.form}|${r.block}`;
    rowsByBlock.set(k, [...(rowsByBlock.get(k) ?? []), r]);
  }
  const disabled = !canEdit;
  return (
    <form action={saveLine} className="card" style={issues.some((i) => i.severity === "block") ? { borderColor: "var(--red)" } : undefined}>
      <fieldset disabled={disabled} style={{ border: 0, padding: 0, margin: 0 }}>
        <input type="hidden" name="site_id" value={siteId} />
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="workstream_id" value={wsId} />
        {line && <input type="hidden" name="id" value={line.id} />}
        <div className="row">
          <div style={{ flex: "2 1 320px" }}>
            <label>AER form row</label>
            <select name="form_row_key" required defaultValue={line?.form_row_key ?? ""}>
              <option value="" disabled>Choose the row on Form 001-A / 001-B…</option>
              {[...rowsByBlock.entries()].map(([k, rows]) => {
                const [form, block] = k.split("|") as [string, string];
                return (
                  <optgroup key={k} label={`Form ${form} · ${BLOCK_TITLE[block] ?? block}`}>
                    {rows.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
                  </optgroup>
                );
              })}
            </select>
          </div>
          <div>
            <label>Category</label>
            <select name="cost_category" defaultValue={line?.cost_category ?? "other"}>
              {Object.entries(COST_CATEGORY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
        <label>Task</label>
        <input name="task" defaultValue={line?.task ?? ""} />
        <div className="row">
          <div>
            <label>Calculation</label>
            <select name="calc_mode" defaultValue={line?.calc_mode ?? "qty_x_rate"}>
              <option value="qty_x_rate">Quantity × unit rate</option>
              <option value="percent_of_base">Percent × base amount</option>
            </select>
          </div>
          <div><label>Quantity (or percent, e.g. 10 for 10%)</label><input name="quantity" type="number" step="any" defaultValue={qty} /></div>
          <div><label>Unit</label><input name="unit" defaultValue={line?.unit ?? ""} placeholder="t, m3, year, month, ha, ls…" /></div>
          <div><label>Unit rate (or base amount, $)</label><input name="unit_rate" type="number" step="any" defaultValue={line?.unit_rate ?? ""} /></div>
        </div>
        <div className="row">
          <div>
            <label>Rate sheet (Req. 3, 58(j))</label>
            <select name="rate_sheet_id" defaultValue={line?.rate_sheet_id ?? ""}>
              <option value="">None</option>
              {sheets.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
          </div>
          <div><label>Page / line in the rate sheet</label><input name="rate_sheet_ref" defaultValue={line?.rate_sheet_ref ?? ""} /></div>
          {kind === "abandonment" && (
            <div>
              <label>Supporting document (scrap-metal credit)</label>
              <select name="supporting_document_id" defaultValue={line?.supporting_document_id ?? ""}>
                <option value="">None</option>
                {docs.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
              </select>
            </div>
          )}
          {kind === "mgmt_admin" && (
            <div>
              <label>Req. 5 item this line covers</label>
              <select name="req5_item" defaultValue={line?.req5_item ?? ""}>
                <option value="">Not tagged</option>
                {REQ_5_ITEMS.filter((i) => i !== "k").map((i) => <option key={i} value={i}>({i}) {REQ_5_LABELS[i]}</option>)}
              </select>
            </div>
          )}
        </div>
        {kind === "contingencies" && (
          <div className="row">
            <div>
              <label>Contingency type</label>
              <select name="contingency_kind" defaultValue={line?.contingency_kind ?? ""} required>
                <option value="" disabled>Choose…</option>
                {Object.entries(CONTINGENCY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div style={{ flex: "3 1 360px" }}>
              <label>Rationale for the amount</label>
              <textarea name="rationale" defaultValue={line?.rationale ?? ""} />
            </div>
          </div>
        )}
        <label>Notes</label>
        <input name="notes" defaultValue={line?.notes ?? ""} />
        {canEdit && (
          <p style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button type="submit">{line ? "Save line" : "Add line"}</button>
            {line && <button type="submit" formAction={deleteLine} className="danger">Delete</button>}
            {line && <span className="sub">Total <strong>{formatCad(toCents(line.total))}</strong></span>}
          </p>
        )}
      </fieldset>
      {!canEdit && line && <p className="sub">Total <strong>{formatCad(toCents(line.total))}</strong></p>}
      {issues.length > 0 && <IssueList issues={issues} />}
    </form>
  );
}
