"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMembership, requireSiteAccess, requireUser } from "@/lib/db/access";
import { back } from "@/lib/flash";
import { isUuid, str, strOrNull } from "./util";

export async function createOrganization(fd: FormData) {
  // requireUser(), not requireMembership(): brand-new users have no organization yet.
  const { supabase } = await requireUser();
  const here = str(fd, "another") === "1" ? "/onboarding?new=1" : "/onboarding";
  const kind = str(fd, "kind");
  if (!["licensee", "contractor", "assessor_firm"].includes(kind)) back(here, { error: "Choose an organization type." });
  const { error } = await supabase.rpc("create_organization", { p_name: str(fd, "name"), p_kind: kind, p_ba_id: strOrNull(fd, "ba_id") });
  if (error) back(here, { error: error.message });
  redirect("/sites");
}

export async function createSite(fd: FormData) {
  const { supabase, user, memberships } = await requireMembership();
  const orgId = str(fd, "licensee_org_id");
  const ok = memberships.some((m) => m.org.id === orgId && m.org.kind === "licensee" && m.role === "admin");
  if (!ok) back("/sites", { error: "Only a licensee organization admin can create sites." });
  const siteType = str(fd, "site_type");
  if (!["well", "facility", "pipeline", "owm_facility"].includes(siteType)) back("/sites", { error: "Choose a site type." });

  const { data, error } = await supabase
    .from("sites")
    .insert({
      licensee_org_id: orgId,
      site_type: siteType,
      is_landfill: fd.get("is_landfill") === "on",
      licence_no: strOrNull(fd, "licence_no"),
      lsd: strOrNull(fd, "lsd"),
      facility_type: strOrNull(fd, "facility_type"),
      site_name: strOrNull(fd, "site_name"),
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !data) back("/sites", { error: error?.message ?? "Could not create the site." });
  redirect(`/sites/${data.id}`);
}

export async function grantAccess(fd: FormData) {
  const siteId = str(fd, "site_id");
  const a = await requireSiteAccess(siteId);
  const path = `/sites/${siteId}/access`;
  if (!a.isLicenseeAdmin) back(path, { error: "Only a licensee admin can grant access." });
  const orgId = str(fd, "org_id");
  const role = str(fd, "role");
  if (!isUuid(orgId)) back(path, { error: "Paste the other organization's ID (a UUID). They can copy it from their Sites page." });
  if (role !== "contractor" && role !== "lead_assessor") back(path, { error: "Choose a role." });
  const { error } = await a.supabase.from("site_grants").insert({ site_id: siteId, grantee_org_id: orgId, role, granted_by: a.userId });
  if (error) {
    const msg = error.code === "23503" ? "No organization has that ID." : error.code === "23505" ? "That organization already has this role." : error.message;
    back(path, { error: msg });
  }
  revalidatePath(path);
  back(path, { ok: "Access granted." });
}

export async function revokeAccess(fd: FormData) {
  const siteId = str(fd, "site_id");
  const a = await requireSiteAccess(siteId);
  const path = `/sites/${siteId}/access`;
  if (!a.isLicenseeAdmin) back(path, { error: "Only a licensee admin can revoke access." });
  const { error } = await a.supabase.from("site_grants").delete().eq("id", str(fd, "grant_id")).eq("site_id", siteId);
  if (error) back(path, { error: error.message });
  back(path, { ok: "Access revoked." });
}

export async function assignWorkstream(fd: FormData) {
  const siteId = str(fd, "site_id");
  const a = await requireSiteAccess(siteId);
  const path = `/sites/${siteId}/access`;
  if (!a.isLicenseeAdmin) back(path, { error: "Only a licensee admin can assign workstreams." });
  const { error } = await a.supabase.from("workstream_assignments").insert({
    workstream_id: str(fd, "workstream_id"),
    org_id: str(fd, "org_id"),
    assigned_by: a.userId,
  });
  if (error) {
    back(path, { error: error.code === "23505" ? "That organization is already assigned." : error.code === "23514" ? "Grant the organization contractor access to the site first." : error.message });
  }
  back(path, { ok: "Workstream assigned." });
}

export async function unassignWorkstream(fd: FormData) {
  const siteId = str(fd, "site_id");
  const a = await requireSiteAccess(siteId);
  const path = `/sites/${siteId}/access`;
  if (!a.isLicenseeAdmin) back(path, { error: "Only a licensee admin can change assignments." });
  const { error } = await a.supabase.from("workstream_assignments").delete().eq("id", str(fd, "assignment_id"));
  if (error) back(path, { error: error.message });
  back(path, { ok: "Assignment removed." });
}

/** Facts the app cannot derive for the completeness tracker (Req. 58(g)(i), (g)(ii), (i), (k)). */
export async function saveManualStatus(fd: FormData) {
  const siteId = str(fd, "site_id");
  const a = await requireSiteAccess(siteId);
  const path = `/sites/${siteId}`;
  if (!a.isLicenseeAdmin) back(path, { error: "Only a licensee admin can change these confirmations." });
  const aerDate = str(fd, "aer_date");
  const aerRef = str(fd, "aer_ref");
  if ((aerDate && !aerRef) || (!aerDate && aerRef)) back(path, { error: "Enter both the date and the reference for the AER system update, or neither." });
  const ld = str(fd, "liabilityDeclaration");
  const manual = {
    liabilityDeclaration: ["none", "generated", "signed"].includes(ld) ? ld : "none",
    costFormsGenerated: fd.get("costFormsGenerated") === "on",
    supportingInfoNoneRequiredReason: strOrNull(fd, "supportingReason"),
    aerSystemUpdate: aerDate ? { date: aerDate, reference: aerRef } : null,
  };
  const { data, error } = await a.supabase
    .from("assessments")
    .update({ manual_status: manual })
    .eq("site_id", siteId)
    .is("locked_at", null)
    .select("id");
  if (error || !data?.length) back(path, { error: error?.message ?? "Could not save (assessment locked or not permitted)." });
  back(path, { ok: "Confirmations saved." });
}
