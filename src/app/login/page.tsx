import { Flash } from "@/components/ui";
import { signIn, signUp } from "../actions/auth";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const { error, ok } = await searchParams;
  return (
    <>
      <h1>CORE SSLA</h1>
      <p className="sub">Collect, review and package the information for an AER Directive 001 site-specific liability assessment.</p>
      <Flash error={error} ok={ok} />
      <div className="row">
        <form action={signIn} className="card">
          <h2 style={{ marginTop: 0 }}>Sign in</h2>
          <label htmlFor="si-email">Email</label>
          <input id="si-email" name="email" type="email" autoComplete="email" required />
          <label htmlFor="si-pw">Password</label>
          <input id="si-pw" name="password" type="password" autoComplete="current-password" required />
          <p><button type="submit">Sign in</button></p>
        </form>
        <form action={signUp} className="card">
          <h2 style={{ marginTop: 0 }}>Create an account</h2>
          <label htmlFor="su-name">Full name</label>
          <input id="su-name" name="full_name" autoComplete="name" required />
          <label htmlFor="su-email">Work email</label>
          <input id="su-email" name="email" type="email" autoComplete="email" required />
          <label htmlFor="su-pw">Password (10+ characters)</label>
          <input id="su-pw" name="password" type="password" autoComplete="new-password" minLength={10} required />
          <p className="sub">After confirming your email you will set up your organization: a licensee, a contractor, or an assessor firm.</p>
          <p><button type="submit">Create account</button></p>
        </form>
      </div>
    </>
  );
}
