"use server";

import { requireMembership, requireSiteAccess, requireUser } from "@/lib/db/access";
import { back } from "@/lib/flash";
import { loadExportData, buildArtifacts, collectUploadedFiles, packageProblems, signoffProblems } from "@/lib/export/data";
import { buildZip, type PackageFile } from "@/lib/package/zip";
import { STATEMENT_TEXT_VERSION } from "@/lib/signoff/checks";
import { isUuid, str, strOrNull } from "./util";

const ASSOCIATIONS = ["APEGA", "AIA", "ASET", "ASPB", "ACPA", "AAFMP", "OTHER_CERTIFIED"];

// ------------------------------------------------------------------ comments
export async function addComment(fd: FormData) {
  const siteId = str(fd, "site_id");
  const kind = str(fd, "kind");
  const path = `/sites/${siteId}/w/${kind}#comments`;
  const a = await requireSiteAccess(siteId);
  const body = str(fd, "body");
  if (!body) back(path, { error: "Write a comment first." });
  const { error } = await a.supabase.from("comments").insert({ workstream_id: str(fd, "workstream_id"), author_id: a.userId, body });
  if (error) back(path, { error: error.code === "42501" ? "You can't comment on this workstream." : error.message });
  back(path, { ok: "Comment added." });
}

export async function setCommentResolved(fd: FormData) {
  const siteId = str(fd, "site_id");
  const kind = str(fd, "kind");
  const path = `/sites/${siteId}/w/${kind}#comments`;
  const a = await requireSiteAccess(siteId);
  const resolved = str(fd, "resolved") === "1";
  const { data, error } = await a.supabase
    .from("comments")
    .update({ resolved_at: resolved ? new Date().toISOString() : null })
    .eq("id", str(fd, "comment_id"))
    .select("id");
  if (error || !data?.length) back(path, { error: error?.message ?? "You can't change this comment." });
  back(path, {});
}

// ------------------------------------------------------------------ professional credentials (Req. 53)
export async function saveCredential(fd: FormData) {
  const { supabase, user } = await requireMembership();
  const path = "/account/credentials";
  const association = str(fd, "association");
  const reg = str(fd, "registration_no");
  if (!ASSOCIATIONS.includes(association)) back(path, { error: "Choose an association." });
  if (!reg) back(path, { error: "Enter your registration or certification number." });
  const { error } = await supabase.from("assessor_credentials").upsert(
    {
      user_id: user.id,
      association,
      registration_no: reg,
      good_standing_attested_at: fd.get("good_standing") === "on" ? new Date().toISOString() : null,
    },
    { onConflict: "user_id,association" },
  );
  if (error) back(path, { error: error.message });
  back(path, { ok: "Saved." });
}

export async function deleteCredential(fd: FormData) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("assessor_credentials").delete().eq("user_id", user.id).eq("association", str(fd, "association"));
  if (error) back("/account/credentials", { error: error.message });
  back("/account/credentials", { ok: "Removed." });
}

// ------------------------------------------------------------------ assessment report: date, limitations (Req. 48), personnel (Req. 51)
async function assessmentId(siteId: string, supabase: Awaited<ReturnType<typeof requireSiteAccess>>["supabase"]): Promise<string | null> {
  const { data } = await supabase.from("assessments").select("id").eq("site_id", siteId).order("version_no", { ascending: false }).limit(1).maybeSingle();
  return data?.id ?? null;
}

export async function saveReport(fd: FormData) {
  const siteId = str(fd, "site_id");
  const path = `/sites/${siteId}/report`;
  const a = await requireSiteAccess(siteId);
  const id = await assessmentId(siteId, a.supabase);
  if (!id) back(path, { error: "Assessment not found." });
  const { error } = await a.supabase.rpc("update_assessment_report", {
    p_assessment: id,
    p_date: strOrNull(fd, "assessment_date"),
    p_limitations: str(fd, "limitations_text"),
  });
  if (error) back(path, { error: error.message });
  back(path, { ok: "Report details saved." });
}

export async function addPersonnel(fd: FormData) {
  const siteId = str(fd, "site_id");
  const path = `/sites/${siteId}/report#personnel`;
  const a = await requireSiteAccess(siteId);
  const id = await assessmentId(siteId, a.supabase);
  if (!id) back(path, { error: "Assessment not found." });
  if (!str(fd, "name") || !str(fd, "role")) back(path, { error: "Enter at least a name and a role." });
  const { error } = await a.supabase.from("personnel").insert({
    assessment_id: id,
    name: str(fd, "name"),
    role: str(fd, "role"),
    technical_training: strOrNull(fd, "technical_training"),
    experience: strOrNull(fd, "experience"),
  });
  if (error) back(path, { error: error.code === "42501" ? "Only the licensee admin or lead assessor can edit personnel." : error.message });
  back(path, { ok: "Person added." });
}

export async function deletePersonnel(fd: FormData) {
  const siteId = str(fd, "site_id");
  const path = `/sites/${siteId}/report#personnel`;
  const a = await requireSiteAccess(siteId);
  const { data, error } = await a.supabase.from("personnel").delete().eq("id", str(fd, "id")).select("id");
  if (error || !data?.length) back(path, { error: error?.message ?? "Not removed." });
  back(path, { ok: "Removed." });
}

// ------------------------------------------------------------------ sign-off (Req. 52-57)
export async function signStatement(fd: FormData) {
  const siteId = str(fd, "site_id");
  const path = `/sites/${siteId}/signoff`;
  const a = await requireSiteAccess(siteId);
  if (!a.isAssessor) back(path, { error: "Only the site's lead assessor can sign." });
  const statement = str(fd, "statement");
  if (statement !== "care_susp_aband" && statement !== "remediation_reclamation") back(path, { error: "Unknown statement." });

  const d = await loadExportData(siteId);
  const { data: creds } = await a.supabase
    .from("assessor_credentials")
    .select("association, registration_no, good_standing_attested_at")
    .eq("user_id", a.userId);
  const problems = signoffProblems(d, creds ?? [], {
    req54: fd.get("req54") === "on",
    req56: fd.get("req56") === "on",
    req57: fd.get("req57") === "on",
  });
  if (problems.length > 0) back(path, { error: `Can't sign yet: ${problems.length} item${problems.length === 1 ? "" : "s"} to resolve (listed below).` });

  const { error } = await a.supabase.rpc("sign_statement", {
    p_assessment: d.bundle.assessment.id,
    p_statement: statement,
    p_text_version: STATEMENT_TEXT_VERSION,
  });
  if (error) back(path, { error: error.message });
  back(path, { ok: "Statement signed." });
}

export async function reopenAssessment(fd: FormData) {
  const siteId = str(fd, "site_id");
  const path = `/sites/${siteId}/signoff`;
  const a = await requireSiteAccess(siteId);
  if (!a.isLicenseeAdmin) back(path, { error: "Only a licensee admin can reopen a signed assessment." });
  const id = str(fd, "assessment_id");
  if (!isUuid(id)) back(path, { error: "Assessment not found." });
  const { error } = await a.supabase.rpc("reopen_assessment", { p_assessment: id });
  if (error) back(path, { error: error.message });
  back(path, { ok: "Reopened. Both sign-offs were cleared; the audit log keeps them." });
}

// ------------------------------------------------------------------ submission package (Req. 58)
export async function buildPackage(fd: FormData) {
  const siteId = str(fd, "site_id");
  const path = `/sites/${siteId}/export`;
  const a = await requireSiteAccess(siteId);
  if (!a.isLicenseeAdmin) back(path, { error: "Only a licensee admin can build the package." });

  const d = await loadExportData(siteId);
  const problems = packageProblems(d);
  if (problems.length > 0) back(path, { error: `The package can't be built yet: ${problems.length} item${problems.length === 1 ? "" : "s"} to fix (listed below).` });

  const art = await buildArtifacts(d);
  const uploaded = await collectUploadedFiles(d);
  if (uploaded.missing.length > 0) back(path, { error: `These files could not be read from storage: ${uploaded.missing.join(", ")}. Re-upload them and try again.` });

  const files: PackageFile[] = [
    { path: `01-forms/${art.costForms.name}`, data: art.costForms.data, req: "Req. 58(g)(ii)" },
    { path: `01-forms/${art.liabilityDeclaration.name}`, data: art.liabilityDeclaration.data, req: "Req. 58(g)(i)" },
    { path: `01-forms/${art.acknowledgements.name}`, data: art.acknowledgements.data, req: "Req. 58(g)(iii)" },
    { path: `02-cost-detail/${art.schedule.name}`, data: art.schedule.data, req: "Req. 58(h)" },
    ...uploaded.files,
  ];
  const { data: prof } = await a.supabase.from("profiles").select("full_name, email").eq("user_id", a.userId).maybeSingle();
  const generatedAt = new Date().toISOString();
  const { zip, manifest } = buildZip(
    files,
    {
      siteName: d.bundle.site.site_name ?? d.bundle.site.licence_no ?? "Untitled site",
      licenceNumber: d.bundle.site.licence_no ?? "NEW",
      licensee: d.licenseeName,
      generatedAt,
      generatedBy: prof?.full_name || prof?.email || "unknown",
    },
    d.tracker,
  );

  const objectPath = `${a.actingOrgId}/${siteId}/ssla-package-${generatedAt.replace(/[-:.]/g, "").slice(0, 15)}.zip`;
  const { error: upErr } = await a.supabase.storage.from("site-files").upload(objectPath, zip, { contentType: "application/zip" });
  if (upErr) back(path, { error: `Could not store the package: ${upErr.message}` });
  const { error } = await a.supabase.from("package_exports").insert({
    assessment_id: d.bundle.assessment.id,
    storage_path: objectPath,
    manifest,
    generated_by: a.userId,
  });
  if (error) {
    await a.supabase.storage.from("site-files").remove([objectPath]);
    back(path, { error: error.message });
  }
  back(path, { ok: `Package built: ${files.length} files.` });
}
