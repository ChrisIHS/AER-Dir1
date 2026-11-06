"use server";

import { headers } from "next/headers";
import { requireMembership, requireSiteAccess } from "@/lib/db/access";
import { loadSiteBundle } from "@/lib/db/load";
import { OFFICER_STATEMENT, OFFICER_STATEMENT_VERSION } from "@/lib/declaration";
import { back } from "@/lib/flash";
import { pathBelongsTo, validateUpload } from "@/lib/uploads";
import { verifyUploadedObject } from "@/lib/uploadsServer";
import { isUuid, safeFileName, str, strOrNull } from "./util";

// ------------------------------------------------------------------ organization rate library
export async function uploadLibrarySheet(fd: FormData) {
  const { supabase, user, memberships } = await requireMembership();
  const path = "/library";
  const orgId = str(fd, "org_id");
  if (!memberships.some((m) => m.org.id === orgId)) back(path, { error: "Choose one of your organizations." });
  // The browser already uploaded the file through a signed URL; confirm it arrived and is where it should be.
  const objectPath = str(fd, "object_path");
  const problem = validateUpload(str(fd, "file_name"), 1);
  if (problem && !/empty/.test(problem)) back(path, { error: problem });
  if (!pathBelongsTo(objectPath, { orgId, library: true })) back(path, { error: "That upload doesn't belong to your library." });
  const gone = await verifyUploadedObject(objectPath);
  if (gone) back(path, { error: gone });
  const title = str(fd, "title");
  if (!title) {
    await supabase.storage.from("site-files").remove([objectPath]);
    back(path, { error: "Give the rate sheet a title." });
  }

  const discount = str(fd, "discount_type");
  const { error } = await supabase.from("rate_library").insert({
    org_id: orgId,
    uploaded_by: user.id,
    vendor: strOrNull(fd, "vendor"),
    title,
    effective_date: strOrNull(fd, "effective_date"),
    storage_path: objectPath,
    discount_type: ["none", "available_to_all", "client_specific", "multi_site"].includes(discount) ? discount : "none",
    notes: strOrNull(fd, "notes"),
  });
  if (error) {
    await supabase.storage.from("site-files").remove([objectPath]);
    back(path, { error: error.message });
  }
  back(path, { ok: "Added to your library." });
}

export async function deleteLibrarySheet(fd: FormData) {
  const { supabase } = await requireMembership();
  const path = "/library";
  const id = str(fd, "id");
  const { data: row } = await supabase.from("rate_library").select("storage_path").eq("id", id).maybeSingle();
  if (!row) back(path, { error: "Not found." });
  const { data: gone, error } = await supabase.from("rate_library").delete().eq("id", id).select("id");
  if (error || !gone?.length) back(path, { error: error?.message ?? "Not deleted." });
  await supabase.storage.from("site-files").remove([row.storage_path]);
  back(path, { ok: "Removed from your library. Copies already used on sites are unaffected." });
}

/**
 * Use a library entry on a site: the file is COPIED into the site so the submission package is self-contained
 * and the cited rates can't change later. The copy remembers its source (rate_sheets.source_library_id).
 */
export async function applyLibrarySheet(fd: FormData) {
  const siteId = str(fd, "site_id");
  const libraryId = str(fd, "library_id");
  const path = `/sites/${siteId}/rate-sheets`;
  if (!isUuid(siteId) || !isUuid(libraryId)) back("/library", { error: "Choose a site and a rate sheet." });
  const a = await requireSiteAccess(siteId);

  const { data: lib } = await a.supabase.from("rate_library").select("*").eq("id", libraryId).maybeSingle();
  if (!lib) back(path, { error: "That library entry isn't available to you." });

  const fileName = String(lib.storage_path).split("/").pop()!.replace(/^[0-9a-f-]{36}-/, "");
  const dest = `${a.actingOrgId}/${siteId}/${crypto.randomUUID()}-${safeFileName(fileName)}`;
  const { error: copyErr } = await a.supabase.storage.from("site-files").copy(lib.storage_path, dest);
  if (copyErr) back(path, { error: `Could not copy the file: ${copyErr.message}` });

  const { error } = await a.supabase.from("rate_sheets").insert({
    site_id: siteId,
    uploaded_by_org: a.actingOrgId,
    uploaded_by: a.userId,
    vendor: lib.vendor,
    title: lib.title,
    effective_date: lib.effective_date,
    storage_path: dest,
    discount_type: lib.discount_type,
    source_library_id: lib.id,
  });
  if (error) {
    await a.supabase.storage.from("site-files").remove([dest]);
    back(path, { error: error.code === "42501" ? "You can't add rate sheets to this site." : error.message });
  }
  back(path, { ok: `"${lib.title}" added to this site.` });
}

// ------------------------------------------------------------------ senior officer's e-signature on F035
export async function signLiabilityDeclaration(fd: FormData) {
  const siteId = str(fd, "site_id");
  const path = `/sites/${siteId}/signoff#officer`;
  const a = await requireSiteAccess(siteId);
  if (!a.isLicenseeAdmin) back(path, { error: "Only a licensee admin can sign the Liability Declaration." });
  if (fd.get("attest") !== "on") back(path, { error: "Tick the certification to sign." });

  const bundle = await loadSiteBundle(siteId);
  if (!(bundle.signoffs.care_susp_aband && bundle.signoffs.remediation_reclamation)) {
    back(path, { error: "The lead assessor must sign both acknowledgement statements first, so the figures are final." });
  }
  const h = await headers();
  const { error } = await a.supabase.rpc("esign_liability_declaration", {
    p_assessment: bundle.assessment.id,
    p_name: str(fd, "name"),
    p_position: str(fd, "position"),
    p_typed: str(fd, "typed"),
    p_statement: OFFICER_STATEMENT,
    p_version: OFFICER_STATEMENT_VERSION,
    p_hash: bundle.officer.hash,
    p_user_agent: h.get("user-agent"),
  });
  if (error) back(path, { error: error.message });
  back(path, { ok: "Signed. The Liability Declaration now carries your e-signature and the figures it certifies." });
}
