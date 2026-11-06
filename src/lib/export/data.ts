import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadSiteBundle, type SiteBundle } from "@/lib/db/load";
import { fillAcknowledgements, type SignoffInfo } from "@/lib/forms/acknowledgement";
import { fillCostWorkbook, type CostFormTotals } from "@/lib/forms/costForms";
import { fillLiabilityDeclaration } from "@/lib/forms/f035";
import { buildSchedule } from "@/lib/forms/schedule";
import { allLines } from "@/lib/validation/helpers";
import { checkPackage, type PackageProblem } from "@/lib/package/precheck";
import { DOC_FOLDER, DOC_REQ, packageFileName, uniquePath, type PackageFile } from "@/lib/package/zip";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { trackerForSite } from "@/lib/tracker/forSite";
import type { TrackerItem } from "@/lib/tracker/tracker";
import { validate } from "@/lib/validation/engine";
import type { Issue, WorkstreamKind } from "@/lib/validation/types";
import { WORKSTREAM_KINDS } from "@/lib/validation/types";
import { checkSignoff, type SignoffProblem } from "@/lib/signoff/checks";

const REF = (f: string) => path.join(process.cwd(), "reference", f);
const TEMPLATES = {
  costForms: "Directive001-Cost-Estimate-Forms.xlsx",
  f035: "Directive001-F035_LiabilityDeclaration.pdf",
  ack: "Directive001_Acknowledgement-Statement-Forms.docx",
} as const;

const LICENCE_TYPE = { well: "Well", facility: "Facility", pipeline: "Pipeline", owm_facility: "Waste Management" } as const;

export interface PersonnelRow {
  id: string;
  name: string;
  role: string;
  technical_training: string | null;
  experience: string | null;
}
export interface CredentialRow {
  association: string;
  registration_no: string;
  good_standing_attested_at: string | null;
}

export interface ExportData {
  bundle: SiteBundle;
  issues: Issue[];
  tracker: TrackerItem[];
  licenseeName: string;
  baId: string | null;
  personnel: PersonnelRow[];
  signoffInfo: { care_susp_aband: SignoffInfo | null; remediation_reclamation: SignoffInfo | null };
  limitationsText: string | null;
}

/** Everything the exports need, loaded with the service role after the caller has been authorised on the site. */
export async function loadExportData(siteId: string): Promise<ExportData> {
  const bundle = await loadSiteBundle(siteId);
  const db = supabaseAdmin();
  const issues = validate(bundle.ctx);
  const tracker = trackerForSite(bundle, issues);

  const [pers, sign, asm] = await Promise.all([
    db.from("personnel").select("id, name, role, technical_training, experience").eq("assessment_id", bundle.assessment.id).order("name"),
    db.from("signoffs").select("statement, signed_at, credentials_snapshot").eq("assessment_id", bundle.assessment.id),
    db.from("assessments").select("limitations_text").eq("id", bundle.assessment.id).single(),
  ]);

  const info = (stmt: string): SignoffInfo | null => {
    const row = (sign.data ?? []).find((s) => s.statement === stmt);
    if (!row) return null;
    const snap = row.credentials_snapshot as { name?: string; credentials?: { association: string; registration_no: string }[] };
    return {
      name: snap.name || "Lead assessor",
      credentials: (snap.credentials ?? []).map((c) => `${c.association} ${c.registration_no}`).join(", "),
      signedOn: String(row.signed_at).slice(0, 10),
    };
  };

  return {
    bundle,
    issues,
    tracker,
    licenseeName: bundle.licensee.name,
    baId: bundle.licensee.baId,
    personnel: (pers.data ?? []) as PersonnelRow[],
    signoffInfo: { care_susp_aband: info("care_susp_aband"), remediation_reclamation: info("remediation_reclamation") },
    limitationsText: asm.data?.limitations_text ?? null,
  };
}

export function packageProblems(d: ExportData): PackageProblem[] {
  return checkPackage({ tracker: d.tracker, issues: d.issues, documents: d.bundle.documents });
}

export function signoffProblems(
  d: ExportData,
  credentials: CredentialRow[],
  acknowledged: { req54: boolean; req56: boolean; req57: boolean },
): SignoffProblem[] {
  const statuses = Object.fromEntries(
    WORKSTREAM_KINDS.map((k) => [k, { applicable: d.bundle.ctx.workstreams[k].applicable, status: d.bundle.statuses[k] }]),
  ) as Record<WorkstreamKind, { applicable: boolean; status: SiteBundle["statuses"][WorkstreamKind] }>;
  return checkSignoff({
    assessmentDate: d.bundle.assessment.assessment_date,
    limitationsText: d.limitationsText,
    personnel: d.personnel,
    credentials,
    workstreams: statuses,
    issues: d.issues,
    acknowledged,
  });
}

export interface Artifacts {
  costForms: { name: string; data: Buffer };
  liabilityDeclaration: { name: string; data: Buffer };
  acknowledgements: { name: string; data: Buffer };
  schedule: { name: string; data: Buffer };
  totals: CostFormTotals;
}

/** Fill every template from the site data. Filenames carry -DRAFT until the assessment is signed. */
export async function buildArtifacts(d: ExportData): Promise<Artifacts> {
  const { site, assessment, ctx } = d.bundle;
  const stem = `SSLA-${(site.licence_no ?? "NEW").replace(/[^A-Za-z0-9-]+/g, "_")}`;
  const draft = d.bundle.signoffs.care_susp_aband && d.bundle.signoffs.remediation_reclamation ? "" : "-DRAFT";
  const licenceNumber = site.licence_no ?? "NEW";
  const lines = allLines(ctx).map((x) => x.line);

  const [tCost, tF035, tAck] = await Promise.all([
    readFile(REF(TEMPLATES.costForms)),
    readFile(REF(TEMPLATES.f035)),
    readFile(REF(TEMPLATES.ack)),
  ]);

  const { buffer: costBuf, totals } = await fillCostWorkbook(
    tCost,
    {
      licenceNumber,
      licenceType: LICENCE_TYPE[site.site_type],
      legalLandDescription: site.lsd ?? "",
      licenseeNameBaId: d.baId ? `${d.licenseeName} (${d.baId})` : d.licenseeName,
      siteName: site.site_name ?? "",
    },
    lines,
  );

  const f035 = await fillLiabilityDeclaration(tF035, {
    licenceNumber,
    licenseeName: d.licenseeName,
    baId: d.baId ?? "",
    lsd: site.lsd ?? "",
    siteType: site.site_type,
    isLandfill: site.is_landfill,
    facilityType: site.facility_type,
    assessmentDate: assessment.assessment_date,
    suspensionAbandonment: d.bundle.officer.figures.suspensionAbandonmentCents / 100,
    remediation: d.bundle.officer.figures.remediationCents / 100,
    reclamation: d.bundle.officer.figures.reclamationCents / 100,
    total: d.bundle.officer.figures.totalCents / 100,
    officer:
      d.bundle.officer.state === "valid" && d.bundle.officer.latest
        ? {
            name: d.bundle.officer.latest.signer_name,
            position: d.bundle.officer.latest.signer_position,
            typedSignature: d.bundle.officer.latest.typed_signature,
            signedOn: d.bundle.officer.latest.signed_at.slice(0, 10),
            recordId: d.bundle.officer.latest.id,
            contentHash: d.bundle.officer.latest.content_hash,
          }
        : undefined,
  });

  const ack = fillAcknowledgements(tAck, {
    licensee: d.licenseeName,
    siteLicenceAndName: `${licenceNumber} ${site.site_name ?? ""}`.trim(),
    lsd: site.lsd ?? "",
    assessmentDate: assessment.assessment_date ?? "",
    careSuspAband: d.signoffInfo.care_susp_aband,
    remediationReclamation: d.signoffInfo.remediation_reclamation,
  });

  const { buffer: schedule } = await buildSchedule({
    siteName: site.site_name ?? licenceNumber,
    licenceNumber,
    lines: Object.fromEntries(WORKSTREAM_KINDS.map((k) => [k, ctx.workstreams[k].lineItems])) as never,
    rateSheets: d.bundle.rateSheets.map((r) => ({ id: r.id, title: r.title, vendor: r.vendor, effectiveDate: r.effective_date, discountType: r.discount_type })),
    documents: d.bundle.documents.map((x) => ({ id: x.id, title: x.title })),
  });

  return {
    costForms: { name: `${stem}-Forms-001-A-and-001-B${draft}.xlsx`, data: costBuf },
    liabilityDeclaration: { name: `${stem}-F035-Liability-Declaration${draft}.pdf`, data: f035 },
    acknowledgements: { name: `${stem}-Acknowledgement-Statements${draft}.docx`, data: ack },
    schedule: { name: `${stem}-Itemized-Cost-Schedule${draft}.xlsx`, data: schedule },
    totals,
  };
}

/** Download the uploaded plans, supporting documents and rate sheets for the zip (forbidden kinds are never included). */
export async function collectUploadedFiles(d: ExportData): Promise<{ files: PackageFile[]; missing: string[] }> {
  const db = supabaseAdmin();
  const taken = new Set<string>();
  const files: PackageFile[] = [];
  const missing: string[] = [];

  const fetchInto = async (folder: string, title: string, storagePath: string, req: string) => {
    const { data, error } = await db.storage.from("site-files").download(storagePath);
    if (error || !data) {
      missing.push(title);
      return;
    }
    files.push({
      path: uniquePath(`${folder}/${packageFileName(title, storagePath)}`, taken),
      data: new Uint8Array(await data.arrayBuffer()),
      req,
    });
  };

  for (const doc of d.bundle.documents) {
    const folder = DOC_FOLDER[doc.kind];
    if (folder === "excluded") continue;
    await fetchInto(folder, doc.title, doc.storage_path, DOC_REQ[doc.kind]);
  }
  for (const rs of d.bundle.rateSheets) {
    await fetchInto("05-rate-sheets", rs.title, rs.storage_path, "Req. 58(j)");
  }
  return { files, missing };
}
