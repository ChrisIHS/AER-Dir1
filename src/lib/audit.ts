type Row = Record<string, unknown> | null;

const SKIP = new Set(["id", "created_at", "updated_at", "updated_by", "workstream_id", "assessment_id", "site_id"]);

function show(v: unknown): string {
  const s = v === null || v === undefined ? "none" : typeof v === "object" ? JSON.stringify(v) : String(v);
  return s.length > 48 ? `${s.slice(0, 45)}...` : s;
}

/** One-line, human-readable summary of an audit_log row for the viewer. */
export function describeChange(action: string, before: Row, after: Row): string {
  if (action === "UPDATE" && before && after) {
    const keys = Object.keys(after).filter((k) => !SKIP.has(k) && JSON.stringify(before[k]) !== JSON.stringify(after[k]));
    if (keys.length === 0) return "no visible change";
    return keys.map((k) => `${k}: ${show(before[k])} -> ${show(after[k])}`).join("; ");
  }
  const row = action === "DELETE" ? before : after;
  if (!row) return "";
  return Object.entries(row)
    .filter(([k, v]) => !SKIP.has(k) && v !== null && v !== "")
    .slice(0, 4)
    .map(([k, v]) => `${k}: ${show(v)}`)
    .join("; ");
}

export const AUDIT_TABLES = [
  "sites", "site_grants", "assessments", "personnel", "workstreams", "workstream_assignments", "workstream_details",
  "rate_sheets", "documents", "cost_line_items", "comments", "review_events", "signoffs", "package_exports",
] as const;
