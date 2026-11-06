import { redirect } from "next/navigation";
import { Flash } from "@/components/ui";
import { requireUser } from "@/lib/db/access";
import { createOrganization } from "../actions/sites";

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ error?: string; new?: string }> }) {
  const { supabase, user } = await requireUser();
  const { count } = await supabase.from("org_members").select("org_id", { count: "exact", head: true }).eq("user_id", user.id);
  const { error, new: another } = await searchParams;
  // An account that already has an organization only comes here deliberately, to add another (limit: 3).
  if ((count ?? 0) > 0 && another !== "1") redirect("/sites");
  return (
    <>
      <h1>{another === "1" ? "Add another organization" : "Set up your organization"}</h1>
      <p className="sub">Everything you enter belongs to your organization and is isolated from other organizations. Others can only see a site you have been granted access to.</p>
      <Flash error={error} />
      <form action={createOrganization} className="card">
        <input type="hidden" name="another" value={another === "1" ? "1" : ""} />
        <label htmlFor="name">Organization name</label>
        <input id="name" name="name" required />
        <label htmlFor="kind">We are a…</label>
        <select id="kind" name="kind" required defaultValue="">
          <option value="" disabled>Choose…</option>
          <option value="licensee">Licensee / approval holder (asset owner)</option>
          <option value="contractor">Contractor or environmental consultant</option>
          <option value="assessor_firm">Assessor firm (lead assessor)</option>
        </select>
        <label htmlFor="ba_id">AER business associate (BA) ID (licensees)</label>
        <input id="ba_id" name="ba_id" />
        <p><button type="submit">Create organization</button></p>
      </form>
    </>
  );
}
