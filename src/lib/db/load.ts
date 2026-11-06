import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { WorkstreamStatus } from "@/lib/tracker/tracker";
import { WORKSTREAM_KINDS, type DocumentRef, type RateSheet, type ValidationContext, type WorkstreamKind, type WorkstreamState } from "@/lib/validation/types";
import { declarationFigures, declarationHash, officerSignatureState, type DeclarationFigures, type OfficerSignature, type OfficerSignatureState } from "@/lib/declaration";
import { parseDetails, type DetailsByKind } from "@/lib/workstreams/details";
import { rowToLineItem } from "./mapping";
import type { DocumentRow, LineItemRow, ManualStatus, RateSheetRow, SiteRow, WorkstreamRow } from "./types";

export interface SiteBundle {
  site: SiteRow;
  assessment: { id: string; version_no: number; assessment_date: string | null; manual_status: ManualStatus };
  ctx: ValidationContext;
  workstreams: Record<WorkstreamKind, WorkstreamRow>;
  statuses: Record<WorkstreamKind, WorkstreamStatus>;
  rateSheets: RateSheetRow[];
  documents: DocumentRow[];
  assignments: { workstream_id: string; org_id: string; org_name: string }[];
  owners: { workstream: Record<WorkstreamKind, string | null>; licensee: string | null; leadAssessor: string | null };
  signoffs: { care_susp_aband: boolean; remediation_reclamation: boolean };
  licensee: { name: string; baId: string | null };
  /** The senior officer's e-signature on the Liability Declaration, judged against the CURRENT figures. */
  officer: { state: OfficerSignatureState; latest: OfficerSignature | null; hash: string; figures: DeclarationFigures };
  packageCount: number;
}

/**
 * Loads EVERYTHING about a site with the service-role client so rules can see cross-workstream
 * facts (a contractor's V-15 depends on lines they cannot read). Callers must have authorised the
 * user on this site first, and must show only the issues for workstreams the user can read.
 */
export async function loadSiteBundle(siteId: string, now: Date = new Date()): Promise<SiteBundle> {
  const db = supabaseAdmin();
  const { data: site, error: siteErr } = await db
    .from("sites")
    .select("id, licensee_org_id, site_type, is_landfill, licence_no, lsd, site_name, facility_type")
    .eq("id", siteId)
    .single();
  if (siteErr || !site) throw new Error(`site ${siteId} not found`);

  const { data: assessment, error: aErr } = await db
    .from("assessments")
    .select("id, version_no, assessment_date, manual_status")
    .eq("site_id", siteId)
    .order("version_no", { ascending: false })
    .limit(1)
    .single();
  if (aErr || !assessment) throw new Error(`assessment for site ${siteId} not found`);

  const { data: wsRows } = await db
    .from("workstreams")
    .select("id, assessment_id, kind, applicable, na_rationale, status")
    .eq("assessment_id", assessment.id);
  const workstreams = Object.fromEntries((wsRows ?? []).map((w) => [w.kind, w])) as Record<WorkstreamKind, WorkstreamRow>;
  const wsIds = (wsRows ?? []).map((w) => w.id);

  const [detailsRes, linesRes, sheetsRes, docsRes, assignRes, signRes, licenseeRes, assessorRes, esignRes, pkgRes] = await Promise.all([
    db.from("workstream_details").select("workstream_id, data").in("workstream_id", wsIds),
    db.from("cost_line_items").select("*").in("workstream_id", wsIds).order("sort_order").order("created_at"),
    db.from("rate_sheets").select("*").eq("site_id", siteId).order("created_at"),
    db.from("documents").select("*").eq("site_id", siteId).order("created_at"),
    db.from("workstream_assignments").select("workstream_id, org_id, organizations(name)").in("workstream_id", wsIds),
    db.from("signoffs").select("statement").eq("assessment_id", assessment.id),
    db.from("organizations").select("name, ba_id").eq("id", site.licensee_org_id).single(),
    db.from("site_grants").select("organizations(name)").eq("site_id", siteId).eq("role", "lead_assessor"),
    db.from("esignatures").select("id, signer_name, signer_position, typed_signature, content_hash, signed_at").eq("assessment_id", assessment.id),
    db.from("package_exports").select("id", { count: "exact", head: true }).eq("assessment_id", assessment.id),
  ]);

  const detailRaw = new Map((detailsRes.data ?? []).map((d) => [d.workstream_id as string, d.data as unknown]));
  const linesByWs = new Map<string, LineItemRow[]>();
  for (const l of (linesRes.data ?? []) as LineItemRow[]) {
    const arr = linesByWs.get(l.workstream_id) ?? [];
    arr.push(l);
    linesByWs.set(l.workstream_id, arr);
  }

  const wsState = {} as Record<WorkstreamKind, WorkstreamState>;
  const statuses = {} as Record<WorkstreamKind, WorkstreamStatus>;
  const details = {} as Record<string, unknown>;
  for (const kind of WORKSTREAM_KINDS) {
    const w = workstreams[kind];
    if (!w) throw new Error(`workstream ${kind} missing for assessment ${assessment.id}`);
    wsState[kind] = {
      applicable: w.applicable,
      naRationale: w.na_rationale,
      lineItems: (linesByWs.get(w.id) ?? []).map(rowToLineItem),
    };
    statuses[kind] = w.status;
    details[kind] = parseDetails(kind, detailRaw.get(w.id));
  }

  const rateSheets = (sheetsRes.data ?? []) as RateSheetRow[];
  const documents = (docsRes.data ?? []) as DocumentRow[];

  const assignments = (assignRes.data ?? []).map((a) => ({
    workstream_id: a.workstream_id as string,
    org_id: a.org_id as string,
    org_name: (a.organizations as unknown as { name: string } | null)?.name ?? "Unknown organization",
  }));
  const owners = Object.fromEntries(
    WORKSTREAM_KINDS.map((k) => {
      const names = assignments.filter((a) => a.workstream_id === workstreams[k].id).map((a) => a.org_name);
      return [k, names.length > 0 ? names.join(", ") : null];
    }),
  ) as Record<WorkstreamKind, string | null>;

  const signed = new Set((signRes.data ?? []).map((s) => s.statement as string));
  const assessorNames = (assessorRes.data ?? []).map((g) => (g.organizations as unknown as { name: string } | null)?.name).filter(Boolean);

  const ctx: ValidationContext = {
    site: { siteType: site.site_type, isLandfill: site.is_landfill },
    now,
    workstreams: wsState,
    details: details as unknown as DetailsByKind,
    rateSheets: rateSheets.map(
      (r): RateSheet => ({ id: r.id, title: r.title, effectiveDate: r.effective_date, discountType: r.discount_type }),
    ),
    documents: documents.map((d): DocumentRef => ({ id: d.id, kind: d.kind, title: d.title, workstreamKind: kindOf(workstreams, d.workstream_id) })),
  };

  const figures = declarationFigures(ctx);
  const hash = declarationHash({
    licenceNumber: site.licence_no ?? "NEW",
    licenseeName: licenseeRes.data?.name ?? "",
    baId: licenseeRes.data?.ba_id ?? "",
    lsd: site.lsd ?? "",
    assessmentDate: assessment.assessment_date ?? "",
    figures,
  });
  const officer = { ...officerSignatureState((esignRes.data ?? []) as OfficerSignature[], hash), hash, figures };

  return {
    site: site as SiteRow,
    assessment: { ...assessment, manual_status: (assessment.manual_status ?? {}) as ManualStatus },
    ctx,
    workstreams,
    statuses,
    rateSheets,
    documents,
    assignments,
    owners: {
      workstream: owners,
      licensee: licenseeRes.data?.name ?? null,
      leadAssessor: assessorNames.length > 0 ? assessorNames.join(", ") : null,
    },
    signoffs: { care_susp_aband: signed.has("care_susp_aband"), remediation_reclamation: signed.has("remediation_reclamation") },
    licensee: { name: licenseeRes.data?.name ?? "", baId: licenseeRes.data?.ba_id ?? null },
    officer,
    packageCount: pkgRes.count ?? 0,
  };
}

function kindOf(ws: Record<WorkstreamKind, WorkstreamRow>, id: string | null): WorkstreamKind | null {
  if (!id) return null;
  return WORKSTREAM_KINDS.find((k) => ws[k].id === id) ?? null;
}
