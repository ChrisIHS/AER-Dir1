import type { ReactNode } from "react";
import type { Issue } from "@/lib/validation/types";

export function Flash({ error, ok }: { error?: string; ok?: string }) {
  if (error) return <div className="flash error" role="alert">{error}</div>;
  if (ok) return <div className="flash ok" role="status">{ok}</div>;
  return null;
}

export type Tone = "red" | "amber" | "green" | "grey" | "na";

export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

const SEVERITY_LABEL = { block: "Blocks submission", warn: "Warning", info: "Note" } as const;

export function IssueList({ issues, empty = "No issues." }: { issues: Issue[]; empty?: string }) {
  if (issues.length === 0) return <p className="sub">{empty}</p>;
  return (
    <div>
      {issues.map((i, n) => (
        <div key={`${i.ruleId}-${i.lineItemId ?? ""}-${n}`} className={`issue ${i.severity}`}>
          <small>
            {SEVERITY_LABEL[i.severity]} · {i.req} · {i.ruleId}
          </small>
          <div>{i.message}</div>
        </div>
      ))}
    </div>
  );
}

export function FileLink({ siteId, table, id, children }: { siteId: string; table: "rate_sheets" | "documents"; id: string; children: ReactNode }) {
  // Plain anchor on purpose: this route streams a redirect to a signed download URL.
  // eslint-disable-next-line @next/next/no-html-link-for-pages
  return <a href={`/sites/${siteId}/files/${table}/${id}`}>{children}</a>;
}
