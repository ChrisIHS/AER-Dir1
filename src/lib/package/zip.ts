import { createHash } from "node:crypto";
import { zipSync } from "fflate";
import type { TrackerItem } from "@/lib/tracker/tracker";
import type { DocumentKind } from "@/lib/validation/types";

export interface PackageFile {
  path: string;
  data: Uint8Array;
  /** Directive 001 requirement the file answers, for the manifest. */
  req: string;
}

export interface PackageMeta {
  siteName: string;
  licenceNumber: string;
  licensee: string;
  generatedAt: string; // ISO timestamp
  generatedBy: string;
}

export interface Manifest {
  generatedAt: string;
  generatedBy: string;
  site: { name: string; licenceNumber: string; licensee: string };
  files: { path: string; bytes: number; sha256: string; req: string }[];
}

const sha256 = (d: Uint8Array) => createHash("sha256").update(d).digest("hex");

export const DOC_FOLDER: Record<DocumentKind, string> = {
  suspension_plan: "03-plans",
  discontinuation_plan: "03-plans",
  abandonment_plan: "03-plans",
  remediation_plan: "03-plans",
  reclamation_plan: "03-plans",
  phase1_esa: "04-esa-and-supporting-information",
  phase2_esa: "04-esa-and-supporting-information",
  rosc: "04-esa-and-supporting-information",
  site_drawing: "04-esa-and-supporting-information",
  scrap_support: "04-esa-and-supporting-information",
  supporting: "04-esa-and-supporting-information",
  signed_forms: "01-forms",
  // Never packaged (Req. 17); mapped only so the record is total.
  remedial_action_plan: "excluded",
  contamination_mgmt_report: "excluded",
};

export const DOC_REQ: Record<DocumentKind, string> = {
  suspension_plan: "Req. 58(a)",
  discontinuation_plan: "Req. 58(b)",
  abandonment_plan: "Req. 58(c)",
  phase1_esa: "Req. 58(d)",
  phase2_esa: "Req. 58(d)",
  rosc: "Req. 58(d)",
  remediation_plan: "Req. 58(e)",
  reclamation_plan: "Req. 58(f)",
  site_drawing: "Req. 31, 58(i)",
  scrap_support: "Req. 12, 58(i)",
  supporting: "Req. 58(i)",
  signed_forms: "Req. 58(g)",
  remedial_action_plan: "Req. 17",
  contamination_mgmt_report: "Req. 17",
};

/** Safe, readable file name: keeps the extension of the stored object, drops path characters. */
export function packageFileName(title: string, storagePath: string): string {
  const ext = /\.([A-Za-z0-9]{2,5})$/.exec(storagePath)?.[1]?.toLowerCase();
  const base = title.replace(/\.[A-Za-z0-9]{2,5}$/, "").replace(/[^A-Za-z0-9 ._()-]+/g, "_").replace(/\s+/g, " ").trim().slice(0, 90) || "file";
  return ext ? `${base}.${ext}` : base;
}

/** Make `path` unique within `taken` by inserting " (2)", " (3)"... before the extension. */
export function uniquePath(path: string, taken: Set<string>): string {
  if (!taken.has(path.toLowerCase())) {
    taken.add(path.toLowerCase());
    return path;
  }
  const m = /^(.*?)(\.[^./]+)?$/.exec(path)!;
  for (let n = 2; ; n++) {
    const candidate = `${m[1]} (${n})${m[2] ?? ""}`;
    if (!taken.has(candidate.toLowerCase())) {
      taken.add(candidate.toLowerCase());
      return candidate;
    }
  }
}

const STATUS_WORD = { red: "MISSING", amber: "IN PROGRESS", green: "complete", na: "n/a" } as const;

export function readmeText(meta: PackageMeta, tracker: TrackerItem[]): string {
  return [
    "SITE-SPECIFIC LIABILITY ASSESSMENT SUBMISSION PACKAGE",
    "AER Directive 001: Requirements for Site-Specific Liability Assessments (February 2025)",
    "",
    `Licensee:        ${meta.licensee}`,
    `Site:            ${meta.siteName}`,
    `Licence number:  ${meta.licenceNumber}`,
    `Generated:       ${meta.generatedAt} by ${meta.generatedBy} (CORE SSLA)`,
    "",
    "CONTENTS",
    "  01-forms/                 Liability Declaration (F035), Cost Estimate Forms 001-A and 001-B,",
    "                            Acknowledgement Statements (Req. 58(g))",
    "  02-cost-detail/           Itemized cost schedule (Req. 2(c), 58(h))",
    "  03-plans/                 Suspension, discontinuation, abandonment, remediation and reclamation plans (Req. 58(a)-(c), (e), (f))",
    "  04-esa-and-supporting-information/   ESA references and supporting documents (Req. 58(d), (i))",
    "  05-rate-sheets/           Third-party rate sheets (Req. 58(j))",
    "  manifest.json             File list with SHA-256 hashes",
    "",
    "REQ. 58 COMPLETENESS AT THE TIME THIS PACKAGE WAS BUILT",
    ...tracker.map((t) => `  ${t.ref.padEnd(5)} ${t.title.padEnd(52)} ${STATUS_WORD[t.status]}`),
    "",
    "BEFORE YOU SEND IT",
    "  1. The Liability Declaration (F035) must be signed by a senior corporate officer or director.",
    "  2. The lead assessor must apply their professional stamp or seal and signature to the SSLA report and the",
    "     Acknowledgement Statements (Req. 54, 55). This app records the sign-off but does not apply a stamp.",
    "  3. Enter the cost estimate in the AER's designated information submission system (Req. 58(k)).",
    "  4. Email the complete package to ssla@aer.ca (Req. 58).",
    "",
    "Remedial action plans and contamination management reports are not part of an SSLA (Req. 17); cite their",
    "OneStop submission IDs instead.",
    "",
  ].join("\n");
}

/** Zip the files plus README and manifest. */
export function buildZip(files: PackageFile[], meta: PackageMeta, tracker: TrackerItem[]): { zip: Uint8Array; manifest: Manifest } {
  const manifest: Manifest = {
    generatedAt: meta.generatedAt,
    generatedBy: meta.generatedBy,
    site: { name: meta.siteName, licenceNumber: meta.licenceNumber, licensee: meta.licensee },
    files: files.map((f) => ({ path: f.path, bytes: f.data.byteLength, sha256: sha256(f.data), req: f.req })),
  };
  const enc = new TextEncoder();
  const tree: Record<string, Uint8Array> = {
    "00-README.txt": enc.encode(readmeText(meta, tracker)),
    "manifest.json": enc.encode(JSON.stringify(manifest, null, 2)),
  };
  for (const f of files) tree[f.path] = f.data;
  return { zip: zipSync(tree, { level: 6 }), manifest };
}
