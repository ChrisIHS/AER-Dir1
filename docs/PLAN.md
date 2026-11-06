# CORE SSLA — Build Plan

Status: **DRAFT for review. No application code has been written.**
Source of truth: AER Directive 001 (Feb 7, 2025), Req. 1–58. Reference files are in `reference/`.

---

## 0. What the reference files showed (changes to the original spec)

I read all of Directive 001 and every populated cell of the cost-estimate workbook. Findings that change or extend the brief:

| # | Finding | Effect on the build |
|---|---|---|
| 1 | **Forms 001-A and 001-B are two sheets in one Excel workbook** (`Directive001-Cost-estimte-forms.xlsx`). Sheets are unprotected, with fixed rows and live formulas (`F = B*D`, subtotals, totals). | Export fills the real AER workbook (quantity in col B, unit cost in col D) and leaves the formulas alone. No re-drawn lookalike. |
| 2 | **Req. 58(g) also requires three other documents** your brief doesn't list: the Liability Declaration (F035, a fillable PDF with 17 fields, signed by a senior corporate officer) and two Acknowledgement Statements (Word doc, signed by the lead assessor: one for care/custody/suspension/abandonment, one for remediation/reclamation). | Added to completeness tracker, sign-off flow and the package. |
| 3 | Forms are **fixed-row**; your cost model is free-form line items. | Every line item is tagged with a `form_row_key` (a dropdown of the AER rows). Export aggregates by row. Detail goes out as a separate itemized schedule (Req. 2c, 58(h)). See §4.4. |
| 4 | Each form has **one** "Contingency" row, but Req. 34(a) and 49 require restricted-access / missing-history contingency as a *distinct item*, and Req. 20/26 add unevaluated-issue contingency. | Contingencies stay separate in the app and the itemized schedule; the AER workbook gets their sum. **Risk:** AER may want the split visible on the form itself. Worth confirming with an AER-experienced reviewer. |
| 5 | "Phase 1 ESA OneStop ID required" is not literally in Req. 19. It is in the narrative under Req. 17 and in Req. 58(d). | Rule cites **Req. 17 / 19 / 58(d)**. |
| 6 | Req. 53 accepts association members **or** anyone "certified in Canada to conduct ESAs by an agency that provides a comparable degree of professional accountability". | Credential dropdown gets a 7th option, "Other certified (ESA)". |
| 7 | Req. 51 requires a documented table of **all personnel** (role, training, experience); Req. 48 requires a distinct section on deviations/limitations. | New `personnel` table and `limitations` section on the assessment, both gating sign-off. |
| 8 | **Landfills** (Req. 14–15) only need to meet Req. 14. F035 has a landfill checkbox. Pipelines also need a **discontinuation plan** (58(b)). | `sites.is_landfill`; landfill sites mark most rules N/A. Discontinuation plan is a pipeline-only tracker item. |
| 9 | Req. 17: *do not submit* contamination management reports or remedial action plans with an SSLA; cite their OneStop IDs. | Package builder refuses/warns on those document types. |
| 10 | Management & admin (Req. 5) and contingencies span both forms: 001-A and 001-B each have their own Project Management and Contingency blocks. | Workstreams 6 and 7 lines carry a `form_ref` (A or B). |
| 11 | Form 001-A's footnote: *material balance between demolition and transportation/disposal*. Not a numbered Req. | Added as a **warn**-level rule, cited as "Form 001-A note". |
| 12 | Template file name contains a typo (`estimte`) and AER may revise it. | Template is pinned in `reference/` with its SHA-256 recorded in code. A test fails if the template cell map no longer matches. |

I checked every requirement number in your brief against the Directive text. Numbers cited in your brief are correct (Req. 3, 4, 5, 8, 9, 10–12, 18–45, 29, 37, 44, 46–47, 58j).

---

## 1. Stack and why

| Layer | Choice | Reason |
|---|---|---|
| App | **Next.js (App Router) + TypeScript** | Your preference; one codebase for UI and server actions; Vercel-native. |
| DB / auth / files | **Supabase** (Postgres, Auth, RLS, Storage) | Row-level security gives per-org isolation in the database itself, not just in app code. Storage buckets get the same RLS. |
| Hosting | **Vercel**, Supabase region **ca-central-1** | Canadian data residency for Alberta clients; simple deploys. |
| UI | Tailwind + shadcn/ui, react-hook-form + Zod | Few moving parts; Zod schemas double as the per-workstream data contracts. |
| Validation engine | **Pure TypeScript functions** in `src/lib/validation/` | No DB or framework imports, so rules are fast to unit-test with Vitest and run identically in the browser (live feedback) and on the server (gate on submit). |
| Form export | **ExcelJS** (fill AER xlsx), **pdf-lib** (fill F035 PDF), **docxtemplater/PizZip** (Acknowledgement docx), **fflate** (zip) | Fill the real AER files. All run in Node route handlers. |
| Tests | **Vitest** (rules, export mapping), **pgTAP via `supabase test db`** (RLS), **Playwright** (a few end-to-end flows, Phase 2+) | RLS bugs are the biggest risk of a self-serve multi-tenant app, so they get SQL-level tests. |
| Local dev | **Supabase CLI + Docker** (confirmed) | Migrations, seed and email (Mailpit) run locally. Link a hosted project later. |

Constraints worth knowing: Vercel caps serverless response bodies (about 4.5 MB), so the package zip is built server-side, **uploaded to Supabase Storage, and returned as a signed URL**, not streamed from the function. Excel formulas written by ExcelJS have no cached values; I set `fullCalcOnLoad` and also verify totals in tests by recalculating the workbook in LibreOffice headless (CI step).

---

## 2. Roles and permissions

Tenancy model (confirmed): **every user belongs to their own organization; access to a licensee's site is granted per site** (`site_grants`). Self-serve sign-up (confirmed): a new user chooses what kind of organization to create (licensee, contractor, or assessor firm).

| Role (per site) | Granted by | Can see | Can edit | Can approve / sign |
|---|---|---|---|---|
| **Licensee admin** (member of owning org) | Self (creates site) | Everything on their sites | Sites, grants, assignments; any workstream | Approve workstreams; export; generate package |
| **Contractor** (member of a granted org) | Licensee admin, per site, per workstream | **Only** assigned workstreams, their line items, comments, and rate sheets/documents they uploaded or are linked to those workstreams | Assigned workstreams until submitted | None |
| **Lead assessor** (member of a granted org) | Licensee admin, per site | Everything on the site | Comments only; own credentials and personnel table | Return for changes; sign off both acknowledgement statements |

Isolation rules enforced by RLS (not application code):
1. Org A can never read org B's rows, except through an explicit `site_grants` row.
2. Two contractor orgs on the same site can't see each other's workstreams.
3. `audit_log` is append-only (no UPDATE/DELETE grants) and readable by licensee admin and lead assessor only.
4. Storage paths are `org_id/site_id/...`; bucket policies mirror table policies.

Self-serve hardening before any public launch (Phase 1 task, small): email verification, CAPTCHA on sign-up, rate limits, upload size/type limits, terms-of-use acceptance recorded.

---

## 3. Data model

```
organizations(id, name, kind[licensee|contractor|assessor_firm], ba_id)
profiles(user_id, full_name, email)
org_members(org_id, user_id, org_role[admin|member])
assessor_credentials(user_id, association[APEGA|AIA|ASET|ASPB|ACPA|AAFMP|OTHER_CERTIFIED],
                     registration_no, good_standing_attested_at)

sites(id, licensee_org_id, site_type[well|facility|pipeline|owm_facility], is_landfill,
      licence_no, licence_type, lsd / legal_land_description, site_name)
site_grants(id, site_id, grantee_org_id, role[contractor|lead_assessor], granted_by)

assessments(id, site_id, version_no, assessment_date, status[draft|in_review|signed|packaged],
            limitations_text,  -- Req. 48
            locked_at)         -- later versions copy forward (Req. 58 last para)
personnel(id, assessment_id, name, role, technical_training, experience)  -- Req. 51

workstreams(id, assessment_id, kind[care_security|suspension|abandonment|esa_remediation|
            reclamation|contingencies|mgmt_admin], applicable bool, na_rationale,
            status[not_started|in_progress|submitted|changes_requested|approved])
workstream_assignments(workstream_id, org_id, user_id?)
workstream_details(workstream_id, schema_version, data jsonb)   -- Zod-validated per kind

cost_line_items(id, workstream_id, form_ref[001-A|001-B], form_row_key, cost_category,
                task, calc_mode[qty_x_rate|percent_of_base], quantity, unit, unit_rate,
                total  -- generated: round(quantity*unit_rate, 2)
                rate_sheet_id, rate_sheet_ref (page/line), rate_basis, notes,
                contingency_kind?[general|missing_history|unevaluated|restricted_access],
                rationale?, supporting_document_id?)
rate_sheets(id, site_id, uploaded_by_org, vendor, title, effective_date, storage_path,
            discount_type[none|available_to_all|client_specific|multi_site])
documents(id, site_id, assessment_id, workstream_id?, kind[suspension_plan|discontinuation_plan|
          abandonment_plan|phase1_esa|phase2_esa|rosc|remediation_plan|reclamation_plan|
          site_drawing|scrap_support|supporting|signed_forms...], storage_path)

comments(id, workstream_id, line_item_id?, author, body, resolved_at)
review_events(id, workstream_id, actor, action[submit|return|approve], reason)
signoffs(id, assessment_id, statement[care_susp_aband|remediation_reclamation],
         assessor_user_id, credentials_snapshot jsonb, statement_text_version, signed_at)
audit_log(id, site_id, actor, action, table_name, record_id, before jsonb, after jsonb, at)
package_exports(id, assessment_id, storage_path, manifest jsonb, generated_by, generated_at)
```

Decisions:
- **Money** is `numeric(14,2)`; `total` is a DB-generated column so the number can't drift from quantity × rate.
- **`workstream_details` is JSONB + Zod** (per-kind schemas, `schema_version`). ESA/remediation has many fields (OneStop IDs, APECs, volumes, bulking factor, plume irregularity factor, density/moisture, on-site vs off-site, groundwater, Tier 1/2). Directive revisions then need a schema bump, not a migration. Line items stay as real columns because they're summed and exported.
- **Assessments are versioned from day one** (Phase 1 auto-creates version 1) so "build on your existing SSLA" (Req. 58, last paragraph) doesn't need a migration later.
- `audit_log` rows are written by database triggers, so no code path can skip them.

---

## 4. Screens, forms and export

### 4.1 Screens

| Screen | Roles | Phase |
|---|---|---|
| Sign-up / sign-in / create org | all | 1 |
| Site list; create site | licensee | 1 |
| Site overview: completeness tracker (Req. 58 a–k, R/A/G + owner) | all (filtered) | 1 |
| Workstream page (details form + line-item table + issues panel) × 7 | licensee, contractor, assessor | 1 |
| Rate sheets: upload, list, discount flag | licensee, contractor | 1 |
| Access: invite/grant orgs, assign workstreams | licensee | 1 |
| Cost summary (by workstream, by form, grand total) | licensee, assessor | 1 |
| Review queue; comment threads; return / approve | licensee, assessor | 2 |
| Assessor profile (credentials), personnel table, limitations section | assessor | 2 |
| Sign-off (Req. 52–57 statement) | assessor | 2 |
| Audit log viewer (filter by actor/table/date) | licensee, assessor | 2 |
| Export: Forms, package, history | licensee | 2 |
| Portfolio dashboard; rate library; e-signature | licensee | 3 |

### 4.2 Validation gating (confirmed: save always, gate on submit)

Saving a draft is **never** blocked. Each rule has a severity:
- **block**: prevents *submit for review*, *approve*, *sign-off* and *package*.
- **warn**: shown in the issues panel; doesn't stop anything.

Every issue displays its Directive requirement number and links to the offending field or line.

### 4.3 Validation rules → requirements

Your eight rules, plus others the Directive requires. Rules are `(context) => Issue[]`, each in its own file with a table-driven test.

| ID | Rule | Req. | Severity | Notes |
|---|---|---|---|---|
| V-01 | No NPV/discounting of future work | 4 | block | A numeric rule can't see a discount, so: (a) per-workstream attestation "no NPV/escalation/discount applied" required to submit; (b) block if any line has a discount or escalation rate entered; (c) warn on keywords in task/notes ("NPV", "net present", "discount rate", "escalat", "inflation"). |
| V-02 | No salvage/resale credit | 12 | block | Any negative line, or any line categorised `salvage_resale`, is blocked. |
| V-03 | Scrap-metal credit needs a supporting document **and** a rate sheet | 12, 58(j) | block | Applies to the Scrap Metal Value rows (001-A rows 50–51). |
| V-04 | Every rate links to an uploaded rate sheet | 3, 58(j) | block | Applies to any line with a unit rate; also requires `rate_sheet_ref` (page/line). |
| V-05 | Client-specific or multi-site discount | 3, 58(j) | **block** | Req. 3 says such discounts "may not be applied". `available_to_all` discounts only show an info note. *Please confirm block vs warn.* |
| V-06 | Rate sheet staleness | 3 ("current-day") | warn | Effective date older than 12 months. The 12-month threshold is my assumption. |
| V-07 | Bulking factor 1.2–1.4 inclusive | 29 | block if missing, or outside range without justification; warn if in range but no basis text | Applies when excavation volume exists. Boundary tests: 1.19, 1.2, 1.4, 1.41. |
| V-08 | ≥ 3 years of care/measures **and** ≥ 3 years of site security costed | 8 | block | Counts quantities in `year` (and `month`/12). I read Req. 8 as requiring both items to reach 3 years separately. *Confirm.* |
| V-09 | Pipeline: abandon-in-place vs removed stated, per segment | 11 | block | Pipeline sites have segments, each with a method. |
| V-10 | Remediation requires Phase 1 ESA OneStop ID | 17, 19, 58(d) | block | Triggered when any 001-B remediation line exists. |
| V-11 | Tier 2 approach requires OneStop submission ID | 37 | block | |
| V-12 | APECs listed ⇒ Phase 2 ESA ID, unless restricted access is declared with a restricted-access contingency | 21, 34 | block | |
| V-13 | Record of Site Condition ID | 17, 58(d) | warn | Warn only, because an RoSC may not exist yet. |
| V-14 | Backfill import separate from topsoil/overburden handling | 43(c), 44 | block | Distinct categories and form rows. Block if off-site disposal exists but no backfill-import lines; warn on keyword overlap in a single line. |
| V-15 | All Req. 5 (a–k) management/admin items present | 5 | block | Zero allowed only with a rationale. |
| V-16 | Contingencies separate, each with rationale | 20, 26, 34(a), 49 | block | Missing-history, unevaluated, restricted-access each distinct; restricted-access distinct from the general uncertainty contingency. A declared condition with no matching contingency is blocked. |
| V-17 | Volumes: plume irregularity factor and basis documented; site drawing attached | 28, 31 | block | |
| V-18 | Off-site disposal: density, moisture and the determination method present | 32, 33 | block | Not needed if all treatment is on site. |
| V-19 | On-site vs off-site distinguished; on-site treatment/groundwater/system detail present | 39(b), 41, 42, 45 | block | Required fields appear only when those sections are used. |
| V-20 | Landfill sites: only Req. 14 applies | 14, 15 | info | Marks other rules N/A. |
| V-21 | Reclamation plan elements (a–j) addressed | 47 | warn | |
| V-22 | Personnel table complete; lead-assessor credentials valid; limitations section present | 48, 51–53 | block (sign-off only) | |
| V-23 | Signatory statement text accepted (Req. 56) and AER/AEPA named as authorised users (Req. 57) | 54–57 | block (sign-off only) | |
| V-24 | Form 001-A material balance (demolition vs disposal + scrap tonnage) | Form 001-A note | warn | Tolerance 10% (assumption). |
| V-25 | Package must not contain remedial action plans or contamination management reports | 17 | block (package only) | |

### 4.4 Mapping line items to AER form rows

- Each line item selects a `form_row_key` from a fixed list generated from the template's rows (001-A rows 8–23, 27–51, 55–58, 61, 62; 001-B rows 9–10, 13–27, 31–50, 53–61, 64–66, 69).
- A form row has **one** quantity and **one** unit cost. When several line items share a row, the export writes `B = Σ quantity` and `D = Σ total ÷ Σ quantity`, so the workbook formula `B×D` reproduces the exact total. Percentage rows (project management, admin, contingency) write `B = percent` and `D = base amount`.
- The **itemized cost schedule** (every line, with rate source and page) is a separate Excel file in the package. The AER workbook itself is left unmodified apart from the filled cells.
- A test loads the template, finds every input cell, and checks the app's mapping covers each row and writes to no formula cell.

### 4.5 Completeness tracker (Req. 58)

Each item shows status (R/A/G) and an owner. Red = missing or has block issues; amber = present with warnings or awaiting review; green = present, validated and approved.

| 58 | Item | Evidence | Default owner |
|---|---|---|---|
| a | Suspension plan | document + Suspension workstream approved | suspension assignee |
| b | Discontinuation plan (pipelines only) | document; N/A for other site types | pipeline assignee |
| c | Abandonment plan | document + Abandonment workstream approved | abandonment assignee |
| d | Phase 1 and 2 ESA with RoSC (OneStop IDs) | IDs on ESA workstream | ESA consultant |
| e | Remediation plan (IDs of any RAPs) | document + IDs | ESA consultant |
| f | Reclamation plan | document + Reclamation workstream approved | reclamation assignee |
| g | Forms: Liability Declaration (F035); 001-A and 001-B; two acknowledgement statements | generated forms; sign-offs; officer signature recorded | licensee admin / lead assessor |
| h | Detailed estimated costs | all line items valid, all cost workstreams approved | lead assessor |
| i | Additional supporting information | ≥ 1 supporting document, or "none required" with reason | licensee admin |
| j | Third-party rate sheets | every referenced rate sheet uploaded; none unreferenced | licensee admin |
| k | Cost estimate updates in AER's designated system | manual confirmation with date and reference | licensee admin |

---

## 5. Phased build order

**Phase 0 — Foundation (≈ first), no UI features**
1. Scaffold Next.js/TS, Tailwind, shadcn, Vitest, lint, CI; `supabase init`; CLAUDE.md.
2. Migrations: tables above, enums, generated columns, audit triggers.
3. RLS policies + **pgTAP tests** (contractor A vs B, assessor, licensee, outsider; storage policies).
4. Form-template cell map + the template-pinning test.

**Phase 1 — MVP** (your scope)
1. Validation engine and tests first (pure TS, §4.3 rules V-01 → V-19, V-24).
2. Auth, sign-up, org creation, hardening.
3. Sites, grants, workstream assignment.
4. Workstream pages and line-item entry with live issue panel.
5. Rate sheet upload and linking.
6. Completeness tracker and cost summary.
7. Seed data: fictional well, pipeline, facility (one deliberately incomplete, so every R/A/G state is visible), reused as test fixtures.

**Phase 2 (built, see CLAUDE.md for status)** — review workflow and comments, assessor credentials/personnel/limitations, sign-off (V-22, V-23), audit log viewer, export of 001-A/001-B/F035/acknowledgements, itemized schedule, package zip (V-25), export history.

**Phase 3 (built, see CLAUDE.md for status)** — multi-site dashboards, rate library reuse across sites, e-signature (and, if wanted, an upload slot for a stamped signature page).

---

## 6. Test strategy

- **Rules:** table-driven Vitest per rule: passing case, failing case, boundary values, "not applicable" case. A known-good fixture must produce zero blocks; each mutation of it must trigger exactly its one rule.
- **RLS:** pgTAP tests for every table and storage policy, written *before* the screens.
- **Export:** unit tests on the cell map; LibreOffice recalculation compared to the app's own totals; PDF field-name check against F035.
- **E2E (Phase 2+):** Playwright: contractor submits → assessor returns → resubmits → signs → package downloads.

---

## 7. Decisions already made (from your answers)

- New separate repo: `core-ssla/` (this directory). Reference files moved here.
- Own-org tenancy with per-site grants.
- Local Supabase first.
- Self-serve sign-up for any organization type.
- Sign-off = in-app attestation; exported forms carry name, association and registration number; **no stamp image is applied**.
- Save always; gate on submit.
- Fill the real AER files for export.

## 8. Assumptions I'd like confirmed before Phase 0

1. V-05: client-specific/multi-site discounts **block** (not just warn).
2. V-08: care/measures and site security **each** need ≥ 3 years.
3. V-06: 12-month rate-sheet staleness warning; V-24: 10% balance tolerance.
4. V-13: missing RoSC ID is a warning.
5. Contingencies roll into the single form row, with the split shown in the itemized schedule (§0 #4).
6. **Stamp risk:** Req. 54–55 expect the lead assessor's seal/stamp on the report. With in-app attestation only, the exported statements will say "stamp not applied", and the assessor has to apply it outside the app before submission to ssla@aer.ca.
7. Supabase region ca-central-1 for production.
