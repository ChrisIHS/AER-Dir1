# Deploying CORE SSLA: GitHub, Supabase and Vercel

The code is on GitHub (`ChrisIHS/AER-Dir1`). It reaches users in three steps: a **hosted Supabase project** holds the data, **Vercel** runs the app, and **GitHub** triggers builds. Do the steps in this order. Steps marked **You** need your accounts or secrets; nothing in this guide asks you to paste a key into chat.

> **Honest status:** the app has never run against real Supabase or in a browser (see CLAUDE.md). Expect to find and fix a few things on the first deployed run. Use a throwaway test organization and delete it afterwards.

---

## 1. Create the Supabase project (You)

1. supabase.com, New project. Region **Canada (Central, Montreal)** so client data stays in Canada. Choose a strong database password and keep it in your password manager.
2. Project Settings, API: note the **Project URL**, the **anon (public) key**, and the **service_role key** (secret). You'll put them in Vercel in step 4, never in the repo.

## 2. Apply the database migrations (You, from a terminal)

From the project folder, with Node on your PATH:

```bash
npx supabase login
```
```bash
npx supabase link --project-ref YOUR_PROJECT_REF
```
```bash
npx supabase db push
```

`db push` asks for the database password and applies `supabase/migrations/` in order (10 files). It creates the tables, row-level security, the audit log, the RPCs and the private `site-files` storage bucket.

- **Do not run `supabase/seed.sql` on production.** It creates demo users with a known password. It is for local development only.
- Check in Supabase Studio: Table Editor shows the tables with RLS enabled; Storage shows a private bucket `site-files`.
- Later changes: apply new migrations with `db push` **before** deploying code that needs them, and keep each migration backward compatible with the code that is still live.

## 3. Configure Supabase Auth (You)

Authentication settings in the Supabase dashboard:

| Setting | Value |
|---|---|
| Site URL | `https://YOUR-DOMAIN` (your Vercel production URL or custom domain) |
| Redirect URLs | `https://YOUR-DOMAIN/auth/callback` |
| Confirm email | **On** (required: the app relies on confirmed emails) |
| Password | Minimum length 10 or more |
| SMTP | Set up a **custom SMTP provider** (Resend, Postmark, SendGrid...). Supabase's built-in sender is rate-limited and meant for testing only. |
| Attack Protection / CAPTCHA | Enable **Cloudflare Turnstile** (see below) |
| Rate limits | Keep the defaults at least; tighten sign-ups per hour if you see abuse |

**Turnstile (free):** in Cloudflare, Turnstile, add a widget for your domain. Put the **secret key** in Supabase (Auth, Attack Protection). Put the **site key** in Vercel as `NEXT_PUBLIC_TURNSTILE_SITE_KEY`. If you enable CAPTCHA in Supabase but not in Vercel, sign-up and sign-in will fail, so set both.

Self-serve sign-up is open to anyone with an email address. An account can create at most 3 organizations. If you would rather onboard clients by invitation only, turn off "Allow new users to sign up" in Auth and invite users from the dashboard.

## 4. Create the Vercel project (You)

1. vercel.com, Add New, Project, import **ChrisIHS/AER-Dir1** from GitHub. Framework: Next.js (detected). Root directory: the repository root. Leave build and install commands at their defaults.
2. Environment variables. Add these for **Production** (and see the note on previews below):

| Name | Value | Secret? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL from step 1 | no |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key | no |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key | **yes** (mark Sensitive) |
| `NEXT_PUBLIC_SITE_URL` | `https://YOUR-DOMAIN`, no trailing slash | no |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Turnstile site key | no |

3. Settings, Functions: set the function region to the closest to Montreal (an eastern US region such as Washington, D.C.). This keeps database calls fast.
4. Deploy. Vercel then rebuilds on every push to `main`.

**Preview deployments:** Vercel builds every branch and pull request. If you give previews the production variables, previews read and write production data. Either scope the variables to Production only, or create a second Supabase project for Preview and give previews its keys. Leave Vercel's Deployment Protection on so previews aren't public.

**Custom domain:** add it under Settings, Domains, then update `NEXT_PUBLIC_SITE_URL` and the Supabase Site URL and Redirect URLs to match.

## 5. Check the deployment

1. `https://YOUR-DOMAIN/api/health` should return `{"ok":true,"missing":[]}`. If it lists names, those variables are missing; redeploy after adding them.
2. Create an account, confirm the email, create an organization (try a licensee), and create a site.
3. Upload a small PDF as a **rate sheet**. This proves the signed-URL upload, the storage policies and the file download.
4. Add it to the **rate library**, then use it on the site. This exercises the storage copy, the part most likely to need a fix.
5. Walk one workstream through submit, return and approve with a second test account (contractor), then the sign-off pages.
6. Delete the test data: organizations and sites in Supabase Studio, and the test users under Auth.

## 6. GitHub

- The **CI** workflow runs on every push: typecheck, lint, tests and a production build, plus a `database` job that starts Supabase locally and runs the database tests. A red `database` job on its first run is expected information (the real Supabase stack has never run this code).
- In GitHub, Settings, Branches, protect `main` and require the CI checks, so a failing change can't deploy.
- No secrets are needed in GitHub for CI. Do not add the Supabase service key there.

## 7. Before real clients use it

- **Terms and privacy:** the app has no terms of use or privacy policy. Get these written for your business, then link them from the sign-up form. I have not drafted legal text.
- **Backups:** confirm your Supabase plan's backup and point-in-time recovery options. Assessment data is your clients' record.
- **AER e-signature:** confirm with the AER that an electronic signature on F035 is acceptable. The lead assessor's professional stamp (Req. 54, 55) is not applied by the app; clients must stamp the report themselves.
- **Rotate keys** immediately if any key is ever committed, pasted into a chat or exposed. Supabase: Project Settings, API.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Sign-up says CAPTCHA verification failed | Turnstile enabled in Supabase but `NEXT_PUBLIC_TURNSTILE_SITE_KEY` missing or for another domain |
| Confirmation link goes to the wrong site | Supabase Site URL or Redirect URLs don't match `NEXT_PUBLIC_SITE_URL` |
| No confirmation email arrives | SMTP not configured, or the built-in sender's rate limit was hit |
| Upload says "You can't upload here" | The user has no access to that site, or the migrations (storage policies) were not applied |
| "Using a library sheet" fails on the copy | Storage copy permissions; check the storage policies from migration 4 and 9 in Supabase and tell me the exact error |
| Export route returns 500 | Check the Vercel function logs; the AER templates in `reference/` must be in the deployment (they are listed in `next.config.ts`) |
| Package build times out | Large uploads; the page allows 60 seconds, raise `maxDuration` (needs a Vercel plan that allows it) |
