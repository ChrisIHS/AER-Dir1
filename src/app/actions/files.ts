"use server";

import { requireSiteAccess } from "@/lib/db/access";
import { back } from "@/lib/flash";
import { pathBelongsTo, validateUpload } from "@/lib/uploads";
import { verifyUploadedObject } from "@/lib/uploadsServer";
import { isUuid, str, strOrNull } from "./util";

/** Req. 17: remedial action plans and contamination management reports are not submitted; cite OneStop IDs instead. */
const UPLOADABLE_KINDS = new Set([
  "suspension_plan", "discontinuation_plan", "abandonment_plan", "phase1_esa", "phase2_esa", "rosc",
  "remediation_plan", "reclamation_plan", "site_drawing", "scrap_support", "supporting", "signed_forms",
]);

/**
 * The browser has already uploaded the file straight to storage through a signed URL (see UploadForm and
 * /api/uploads/sign). These actions confirm it arrived, then record it; they never receive the file itself.
 */
async function acceptSiteUpload(fd: FormData, siteId: string, actingOrgId: string, back_: (msg: string) => never): Promise<{ objectPath: string; fileName: string }> {
  const objectPath = str(fd, "object_path");
  const fileName = str(fd, "file_name");
  const problem = validateUpload(fileName, 1);
  if (problem && !/empty/.test(problem)) back_(problem);
  if (!pathBelongsTo(objectPath, { orgId: actingOrgId, siteId })) back_("That upload doesn't belong to this site.");
  const gone = await verifyUploadedObject(objectPath);
  if (gone) back_(gone);
  return { objectPath, fileName };
}

export async function uploadRateSheet(fd: FormData) {
  const siteId = str(fd, "site_id");
  const path = `/sites/${siteId}/rate-sheets`;
  const a = await requireSiteAccess(siteId);
  const fail = (error: string): never => back(path, { error });
  const { objectPath } = await acceptSiteUpload(fd, siteId, a.actingOrgId, fail);
  const title = str(fd, "title");
  if (!title) {
    await a.supabase.storage.from("site-files").remove([objectPath]);
    back(path, { error: "Give the rate sheet a title." });
  }

  const discount = str(fd, "discount_type");
  const { error } = await a.supabase.from("rate_sheets").insert({
    site_id: siteId,
    uploaded_by_org: a.actingOrgId,
    uploaded_by: a.userId,
    vendor: strOrNull(fd, "vendor"),
    title,
    effective_date: strOrNull(fd, "effective_date"),
    storage_path: objectPath,
    discount_type: ["none", "available_to_all", "client_specific", "multi_site"].includes(discount) ? discount : "none",
    shared: fd.get("shared") === "on" && a.isLicenseeMember,
  });
  if (error) {
    await a.supabase.storage.from("site-files").remove([objectPath]);
    back(path, { error: error.message });
  }
  back(path, { ok: "Rate sheet uploaded." });
}

export async function uploadDocument(fd: FormData) {
  const siteId = str(fd, "site_id");
  const path = `/sites/${siteId}/documents`;
  const a = await requireSiteAccess(siteId);
  const fail = (error: string): never => back(path, { error });
  const { objectPath, fileName } = await acceptSiteUpload(fd, siteId, a.actingOrgId, fail);
  const kind = str(fd, "kind");
  if (!UPLOADABLE_KINDS.has(kind)) {
    await a.supabase.storage.from("site-files").remove([objectPath]);
    back(path, { error: "Choose a document type." });
  }
  const title = str(fd, "title") || fileName;
  const wsId = str(fd, "workstream_id");

  let assessmentId: string | null = null;
  if (isUuid(wsId)) {
    const { data: ws } = await a.supabase.from("workstreams").select("assessment_id").eq("id", wsId).maybeSingle();
    if (!ws) {
      await a.supabase.storage.from("site-files").remove([objectPath]);
      back(path, { error: "Workstream not found." });
    }
    assessmentId = ws.assessment_id;
  } else {
    const { data: as } = await a.supabase.from("assessments").select("id").eq("site_id", siteId).order("version_no", { ascending: false }).limit(1).maybeSingle();
    assessmentId = as?.id ?? null;
    if (!assessmentId) {
      await a.supabase.storage.from("site-files").remove([objectPath]);
      back(path, { error: "Contractors must attach a document to one of their workstreams." });
    }
  }

  const { error } = await a.supabase.from("documents").insert({
    site_id: siteId,
    assessment_id: assessmentId,
    workstream_id: isUuid(wsId) ? wsId : null,
    uploaded_by_org: a.actingOrgId,
    uploaded_by: a.userId,
    kind,
    title,
    storage_path: objectPath,
  });
  if (error) {
    await a.supabase.storage.from("site-files").remove([objectPath]);
    back(path, { error: error.code === "42501" ? "Not allowed: the workstream may be locked, or site-level documents are for licensee staff and the lead assessor." : error.message });
  }
  back(path, { ok: "Document uploaded." });
}

export async function deleteFile(fd: FormData) {
  const siteId = str(fd, "site_id");
  const table = str(fd, "table");
  const path = `/sites/${siteId}/${table === "rate_sheets" ? "rate-sheets" : "documents"}`;
  if (table !== "rate_sheets" && table !== "documents") back(path, { error: "Unknown file type." });
  const a = await requireSiteAccess(siteId);
  const id = str(fd, "id");
  const { data: row } = await a.supabase.from(table).select("storage_path").eq("id", id).maybeSingle();
  if (!row) back(path, { error: "File not found." });
  const { data: removed, error } = await a.supabase.from(table).delete().eq("id", id).select("id");
  if (error) back(path, { error: error.message });
  if (!removed?.length) back(path, { error: "Not deleted: you didn't upload this file." });
  await a.supabase.storage.from("site-files").remove([row.storage_path]);
  back(path, { ok: "Deleted." });
}
