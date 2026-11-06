import "server-only";
import { notFound, redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import type { OrgRow, SiteRow } from "./types";

export async function requireUser() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

export interface Membership {
  org: OrgRow;
  role: "admin" | "member";
}

type Client = Awaited<ReturnType<typeof supabaseServer>>;

/** Organizations the user belongs to (own, RLS-filtered query). Never redirects: safe for route handlers. */
export async function loadMemberships(supabase: Client, userId: string): Promise<Membership[]> {
  const { data } = await supabase
    .from("org_members")
    .select("org_role, organizations(id, name, kind, ba_id)")
    .eq("user_id", userId);
  return (data ?? []).flatMap((m) => {
    const org = m.organizations as unknown as OrgRow | null;
    return org ? [{ org, role: m.org_role as "admin" | "member" }] : [];
  });
}

/** The signed-in user plus their organizations; sends brand-new users to onboarding. */
export async function requireMembership() {
  const { supabase, user } = await requireUser();
  const memberships = await loadMemberships(supabase, user.id);
  if (memberships.length === 0) redirect("/onboarding");
  return { supabase, user, memberships };
}

export interface SiteAccess {
  supabase: Awaited<ReturnType<typeof supabaseServer>>;
  userId: string;
  site: SiteRow;
  memberOrgIds: string[];
  isLicenseeMember: boolean;
  isLicenseeAdmin: boolean;
  isAssessor: boolean;
  /** Orgs of the user that hold a contractor grant on this site. */
  contractorOrgIds: string[];
  /** Org used as `uploaded_by_org` for files the user adds. */
  actingOrgId: string;
}

/**
 * What the user may do on a site, from their own (RLS-filtered) queries; null when the site is not visible to
 * them. Does not redirect or throw, so route handlers can answer with JSON.
 */
export async function resolveSiteAccess(supabase: Client, userId: string, memberships: Membership[], siteId: string): Promise<SiteAccess | null> {
  const { data: site } = await supabase
    .from("sites")
    .select("id, licensee_org_id, site_type, is_landfill, licence_no, lsd, site_name, facility_type")
    .eq("id", siteId)
    .maybeSingle();
  if (!site) return null;

  const memberOrgIds = memberships.map((m) => m.org.id);
  const licenseeMembership = memberships.find((m) => m.org.id === site.licensee_org_id);
  const { data: grants } = await supabase.from("site_grants").select("grantee_org_id, role").eq("site_id", siteId);
  const mine = (grants ?? []).filter((g) => memberOrgIds.includes(g.grantee_org_id));
  const isAssessor = mine.some((g) => g.role === "lead_assessor");
  const contractorOrgIds = mine.filter((g) => g.role === "contractor").map((g) => g.grantee_org_id);

  return {
    supabase,
    userId,
    site: site as SiteRow,
    memberOrgIds,
    isLicenseeMember: !!licenseeMembership,
    isLicenseeAdmin: licenseeMembership?.role === "admin",
    isAssessor,
    contractorOrgIds,
    actingOrgId: licenseeMembership ? site.licensee_org_id : (mine[0]?.grantee_org_id ?? memberOrgIds[0]!),
  };
}

/** Page and action entry check. 404s when RLS hides the site, so site IDs of other organizations are not confirmable. */
export async function requireSiteAccess(siteId: string): Promise<SiteAccess> {
  const { supabase, user, memberships } = await requireMembership();
  const access = await resolveSiteAccess(supabase, user.id, memberships, siteId);
  if (!access) notFound();
  return access;
}

/** True when the user may see every workstream (licensee staff and lead assessors). */
export const seesAll = (a: SiteAccess) => a.isLicenseeMember || a.isAssessor;
