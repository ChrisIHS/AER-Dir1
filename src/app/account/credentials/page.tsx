import { Flash } from "@/components/ui";
import { requireMembership } from "@/lib/db/access";
import { deleteCredential, saveCredential } from "../../actions/phase2";

const ASSOCIATIONS = [
  ["APEGA", "APEGA: Association of Professional Engineers and Geoscientists of Alberta"],
  ["AIA", "AIA: Alberta Institute of Agrologists"],
  ["ASET", "ASET: Association of Science and Engineering Technology Professionals of Alberta"],
  ["ASPB", "ASPB: Alberta Society of Professional Biologists"],
  ["ACPA", "ACPA: Association of the Chemical Profession of Alberta"],
  ["AAFMP", "AAFMP: Association of Alberta Forest Management Professionals"],
  ["OTHER_CERTIFIED", "Other: certified in Canada to conduct ESAs by an agency with comparable professional accountability"],
] as const;

export default async function CredentialsPage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const { error, ok } = await searchParams;
  const { supabase, user } = await requireMembership();
  const { data } = await supabase
    .from("assessor_credentials")
    .select("association, registration_no, good_standing_attested_at")
    .eq("user_id", user.id);

  return (
    <>
      <h1>My professional credentials</h1>
      <p className="sub">
        A lead assessor must be a member in good standing of one of these Alberta professional bodies, or be certified in Canada to conduct ESAs (Req. 53). Your credentials are copied onto each sign-off you make.
      </p>
      <Flash error={error} ok={ok} />

      {(data ?? []).length > 0 && (
        <table>
          <thead><tr><th>Association</th><th>Registration number</th><th>Good standing attested</th><th /></tr></thead>
          <tbody>
            {(data ?? []).map((c) => (
              <tr key={c.association}>
                <td>{c.association}</td>
                <td>{c.registration_no}</td>
                <td>{c.good_standing_attested_at ? new Date(c.good_standing_attested_at).toLocaleDateString("en-CA") : "No"}</td>
                <td>
                  <form action={deleteCredential}>
                    <input type="hidden" name="association" value={c.association} />
                    <button className="secondary" type="submit">Remove</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <form action={saveCredential} className="card">
        <label htmlFor="association">Association or certification</label>
        <select id="association" name="association" required defaultValue="">
          <option value="" disabled>Choose…</option>
          {ASSOCIATIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <label htmlFor="registration_no">Registration or certification number</label>
        <input id="registration_no" name="registration_no" required />
        <label className="inline">
          <input type="checkbox" name="good_standing" /> I am a member in good standing of this association, or my certification is current.
        </label>
        <p><button type="submit">Save</button></p>
      </form>
    </>
  );
}
