# CORE SSLA — project conventions

Web app that lets AER licensees collect what's needed for a Site-Specific Liability Assessment (SSLA) under **AER Directive 001 (Feb 7, 2025)**. Contractors fill in assigned workstreams, a lead assessor reviews and signs, the licensee exports a submission package for ssla@aer.ca.

**Status:** Phases 0-3 are built and prepared for deployment (docs/DEPLOY.md). Verified here: `npm test` (418 Vitest tests), typecheck, lint, `next build`; all 10 migrations, the seed and the 5 database test files (158 assertions) on an embedded Postgres 18 via `npm run db:test:local` (tools/pg-harness: Supabase auth/storage stubbed, pgTAP shimmed). **Never run:** real Supabase (`db:start`, `supabase test db`; Docker is not installed) and the app in a browser, so server actions, RLS through PostgREST, storage (signed-URL uploads, `copy` for the rate library) and the email/CAPTCHA flow are untested end to end. Node lives at `~/.local/node/bin` (add it to PATH). Code is on GitHub: ChrisIHS/AER-Dir1 (SSH remote).
Phase 1 written (unverified): validation engine V-01..V-21 + V-24, cost summary, Req. 58 tracker, Zod details schemas, demo seed (3 fictional sites), and the app itself: sign-up/sign-in with email confirmation, org onboarding, site list/create, site overview (workstreams, cost summary, tracker), access and assignments, rate-sheet and document upload/download, workstream pages (details form, line items, issues, submit/return/approve). Demo logins are listed at the top of `supabase/seed.sql`.
Phase 2 (built): comments with resolve; assessor credentials (`/account/credentials`); report details (date, Req. 48 limitations, Req. 51 personnel); lead-assessor sign-off of the two acknowledgement statements via the `sign_statement` RPC (locks the assessment; `reopen_assessment` for licensee admins); audit-log viewer; exports (Forms 001-A/B filled from the AER workbook, F035 PDF, acknowledgement docx, itemized schedule) and the submission zip with README and manifest, gated by V-25 and the tracker.
Known limit: licensee grants access by pasting the other organization's ID (shown on their Sites page); there is no email invite yet. The stamp/seal (Req. 54, 55) is not applied by the app: the exports and README say so. Read `docs/PLAN.md` first; it holds the data model, roles, validation rules, and build order.

## Source of truth
- `reference/Directive001.pdf`: numbered requirements (Req. 1–58) win over anything else, including the plan.
- `reference/Directive001-Cost-Estimate-Forms.xlsx`: Forms 001-A and 001-B. Fill this file; never rebuild it. Don't edit or overwrite it. If AER publishes a new version, add it beside this one, update the pinned hash, and re-map.
- `reference/Directive001-F035_LiabilityDeclaration.pdf` and `reference/Directive001_Acknowledgement-Statement-Forms.docx`: Req. 58(g) documents.
- Every validation message must show its requirement number (e.g. "Req. 29").

## Stack
Next.js (App Router) + TypeScript · Supabase (Postgres, Auth, RLS, Storage), local via Supabase CLI + Docker first · Vercel · Tailwind + shadcn/ui · Zod · Vitest · pgTAP · Playwright (Phase 2+).

## Conventions
- **Validation rules are pure functions** in `src/lib/validation/rules/`: no DB, no React, no `fetch`. One file per rule (`vNN-name.ts`), registered in `rules/index.ts`. Each rule has one table-driven `describe` block in `rules-*.test.ts` (pass, fail, boundary, not-applicable). `fixtures.ts` holds `goodContext()`, a complete valid well that must yield zero issues; tests mutate a fresh copy. `engine.test.ts` has a mutation matrix: one fault per rule, which must trigger that rule and no other blocker.
- A rule's issues name the workstream whose submission they gate. The engine drops issues on workstreams marked not applicable (except V-08). Landfills skip section 5 rules (Req. 15) through `section5Applies()`.
- Rule IDs follow docs/PLAN.md section 4.3. V-22, V-23 (sign-off) and V-25 (package) are Phase 2.
- Quantities of care/security must use year/month/week/day units (V-08). Scrap-metal VALUE rows are entered positive and subtracted by the form (`signedCents` in `src/lib/costs.ts`).
- Saving a draft is never blocked. Rules are `block` (stops submit, approve, sign-off, package) or `warn`.
- **Isolation lives in Postgres RLS**, not app code. Every new table ships with RLS policies and a pgTAP test in the same change.
- Tenancy: users belong to their own org; access to a site is a row in `site_grants`. Contractors see only assigned workstreams.
- Money is `numeric(14,2)`. Never use floating-point arithmetic for totals in app code (use integer cents or a decimal library). Line `total` is a DB-generated column.
- `audit_log` is written by DB triggers and is append-only.
- Per-workstream details are JSONB validated by Zod with a `schema_version`.
- Use fictional data only in seeds and fixtures. Never commit real licence numbers, BA IDs, or client documents.
- Secrets go in `.env.local` (gitignored). Never paste keys into chat or commit them.

## Commands
Prerequisites: Node 20+, Docker (Desktop/OrbStack/Colima).
```
npm install
npm run db:start      # local Supabase (Docker)
npm run db:reset      # apply supabase/migrations + seed.sql
npm run db:test       # pgTAP: RLS isolation + workflow/audit (supabase/tests/database)
npm test              # Vitest: form template map (and validation rules from Phase 1)
npm run typecheck && npm run lint
npm run dev
```
Copy `.env.example` to `.env.local` and fill it from `npx supabase status`.

## Database conventions (Phase 0)
- Helpers live in schema `app` (SECURITY DEFINER, `search_path = ''`). Policies call them; never put business logic in policy text.
- A policy on table T must not call a helper that selects from T for the row being inserted (STABLE functions can't see the calling statement's writes, so `INSERT ... RETURNING` fails). Use inline column checks, as `sites` does.
- Workstream status changes only via `public.transition_workstream()`; org creation only via `public.create_organization()`. End users have no INSERT/UPDATE on those columns.
- Validation rules gate submit in the **server action** before calling the RPC. The RPC does not re-check them (Phase 2 hardening: record a validation result the RPC can verify).
- New table checklist: enable RLS, `to authenticated` policies, audit trigger in the migration's table list, revoke anything unneeded, pgTAP test. `anon` gets nothing.
- pgTAP files each carry a copy of the same fixture (no include mechanism). Change both together.
- Form row keys (`001-A:concrete_demolition`) come from `src/lib/forms/templateMap.ts`, generated from the AER workbook. Known ambiguity: 001-B rows 14, 16, 23-25 (child-looking rows under in-situ/ex-situ/backfilling) are all summed by the template's `SUM(F13:F27)`, so each is mapped as an independent line; don't also fill a parent row with the same cost.

## App conventions (Phase 1)
- Two Supabase clients. `supabaseServer()` acts as the user (RLS applies) and is used for every read/write the user triggers. `supabaseAdmin()` (service role, RLS bypassed) is used only by `loadSiteBundle()` to assemble the full `ValidationContext`, because rules need cross-workstream facts a contractor cannot read. Never return raw admin rows to the browser; show only issues for workstreams the user can read (RLS probe), as the site and workstream pages do.
- `requireSiteAccess(siteId)` is the entry check for every site route and server action; it 404s if RLS hides the site. Authorisation itself is RLS plus the RPCs; app-side role checks are for friendlier messages.
- Server actions end with `back(path, {error|ok})` (a redirect with a flash message). Actions never `try/catch` around `redirect`.
- Page files export only the default component (and Next config fields). Shared constants live in `src/lib/`.
- Details forms are driven by `DETAIL_FIELDS` in `src/lib/workstreams/fields.ts`; saving goes through the Zod schema and refuses invalid data instead of resetting it.
- Percent lines: the user types 10, the database stores 0.1 (Form column B), `unit_rate` holds the base amount.

## Export and sign-off conventions (Phase 2)
- Exports fill the AER templates in `reference/` (never rebuild them). `fillCostWorkbook` writes only input cells (B, D; F on the two direct rows) and caches formula results using `formulaEval.ts`; tests prove the form totals equal `summarizeCosts` to the cent. F035 left blank on purpose: senior officer signature, position, date.
- Several lines on one form row are combined so B x D equals the exact total (same rate kept; different rates use the weighted average). Percent rows show 100% x total unless every line is a percent line on one base.
- F035 splits the 001-B total: reclamation = 001-B reclamation subtotal; remediation = the rest of 001-B (ESA, remediation, disposal, project management, contingency).
- Sign-off is only via `sign_statement()` (no direct INSERT on `signoffs`). The DB re-checks approvals, date, limitations text, personnel and credentials; the server action also runs `checkSignoff` (V-22, V-23) and the full rule engine first.
- The package needs tracker items a-f, g.iii, h, j green or n/a, no blocking issues, and no remedial-action-plan / contamination-report documents (V-25, Req. 17). Items g.i, g.ii, i, k are completed around the package.
- Sites carry `facility_type` (Directive 056 Table 1) because F035 asks for it; the options come from the PDF itself.
- Template files are read from `reference/` at runtime; `next.config.ts` lists them in `outputFileTracingIncludes` for the routes that need them.

## Phase 3 conventions
- **Portfolio:** `loadPortfolio()` builds a full `SiteSummary` per site for licensee staff and lead assessors, and only a work queue (`workItems`) for contractor-only sites. It loads one bundle per site in batches of 4; fine for tens of sites, revisit (cache or materialize) before hundreds. CSV cells beginning `= + - @` are prefixed with `'` (formula injection).
- **Rate library:** `rate_library` is per organization (members only). Using an entry COPIES the file into the site (`storage.copy`) and sets `rate_sheets.source_library_id`; the package therefore stays self-contained and cited rates can't change later. Library objects live at `<org>/library/<file>`; `app.can_upload_path` / `can_manage_path` special-case the `library` folder.
- **E-signature (F035):** `esignatures` is written only by `esign_liability_declaration()` (licensee admin, after the lead assessor has signed, typed name must match). The signature stores `content_hash` = SHA-256 of licence, licensee, BA ID, LSD, assessment date and the four F035 figures (`src/lib/declaration.ts`). `officerSignatureState` compares the latest signature to the CURRENT hash: valid, stale (figures changed, so the tracker drops g.i back to "generated"), or none. Re-signing is allowed. Reopening an assessment keeps old signatures; they go stale by hash.
- F035 figures come from `declarationFigures()` (cents), not from the workbook; a test proves they equal the filled workbook's totals.
- Whether the AER accepts an electronic signature on F035 is unconfirmed. The sign-off page says so and tells the user to print and sign by hand if not. The lead assessor's stamp (Req. 54, 55) is still not applied by the app: there is an upload slot (`signed_forms`) for stamped pages, and it goes into `01-forms/` in the package.

## Deployment conventions
- **Uploads never pass through a Vercel function.** `UploadForm` (client) asks `/api/uploads/sign` for a one-time signed URL (Supabase checks the storage INSERT policy when it is created), uploads straight to storage, then calls a server action with `object_path` and `file_name`. The action checks `pathBelongsTo` (exact folder), confirms the object exists and is within 25 MB (`verifyUploadedObject`, admin client) and records it. Rules shared in `src/lib/uploads.ts`.
- Access resolution is split so route handlers can answer JSON: `loadMemberships` / `resolveSiteAccess` never redirect; `requireSiteAccess` wraps them with `notFound()`.
- `/api/health` reports missing environment variables (never values). Middleware answers unauthenticated `/api/*` calls with JSON 401, and lets only `/login`, `/auth/*` and `/api/health` through.
- Sign-up abuse controls: Turnstile CAPTCHA (client widget + Supabase Auth setting; token passed as `captchaToken`), and `create_organization` refuses a 4th organization per account. Terms of use and a privacy policy are NOT written; the owner must supply them.
- Security headers are set in `next.config.ts` (no CSP yet). Long routes set `maxDuration` (export page 60 s, form downloads 30 s).
- Production setup steps are in docs/DEPLOY.md. Never run `supabase/seed.sql` against production (known demo password).

## Open decisions
See `docs/PLAN.md` §8.
