-- CORE SSLA: core tables, enums and indexes. RLS is enabled in 20261105000003.
-- Source of truth: AER Directive 001 (Feb 7, 2025). See docs/PLAN.md section 3.

create schema if not exists app;

-- ---------------------------------------------------------------- enums
create type public.org_kind as enum ('licensee', 'contractor', 'assessor_firm');
create type public.org_role as enum ('admin', 'member');
create type public.site_type as enum ('well', 'facility', 'pipeline', 'owm_facility');
create type public.grant_role as enum ('contractor', 'lead_assessor');
create type public.credential_association as enum
  ('APEGA', 'AIA', 'ASET', 'ASPB', 'ACPA', 'AAFMP', 'OTHER_CERTIFIED');  -- Req. 53
create type public.assessment_status as enum ('draft', 'in_review', 'signed', 'packaged');
create type public.workstream_kind as enum (
  'care_security',     -- Req. 8
  'suspension',        -- Req. 9
  'abandonment',       -- Req. 10-12
  'esa_remediation',   -- Req. 18-45
  'reclamation',       -- Req. 46-47
  'contingencies',     -- Req. 20, 26, 34, 49
  'mgmt_admin'         -- Req. 5
);
create type public.workstream_status as enum
  ('not_started', 'in_progress', 'submitted', 'changes_requested', 'approved');
create type public.form_ref as enum ('001-A', '001-B');
create type public.calc_mode as enum ('qty_x_rate', 'percent_of_base');
create type public.contingency_kind as enum
  ('general', 'missing_history', 'unevaluated', 'restricted_access');
create type public.discount_type as enum
  ('none', 'available_to_all', 'client_specific', 'multi_site');  -- Req. 3
create type public.cost_category as enum (
  'care', 'security', 'suspension', 'abandonment', 'demolition', 'hazardous_materials',
  'transport_disposal', 'scrap_metal', 'esa', 'remediation_on_site', 'remediation_off_site',
  'backfill_import',                 -- Req. 43(c), 44
  'overburden_topsoil_handling',     -- Req. 43(a)(iii), 44
  'reclamation', 'project_management', 'contingency',
  'salvage_resale',                  -- exists only so Req. 12 can block it
  'other'
);
create type public.document_kind as enum (
  'suspension_plan', 'discontinuation_plan', 'abandonment_plan', 'phase1_esa', 'phase2_esa',
  'rosc', 'remediation_plan', 'reclamation_plan', 'site_drawing', 'scrap_support',
  'supporting', 'signed_forms',
  'remedial_action_plan', 'contamination_mgmt_report'   -- Req. 17: must NOT be packaged
);
create type public.signoff_statement as enum ('care_susp_aband', 'remediation_reclamation');
create type public.review_action as enum ('start', 'submit', 'return', 'approve');

-- ---------------------------------------------------------------- identity / tenancy
create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(btrim(name)) > 0),
  kind        public.org_kind not null,
  ba_id       text,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

create table public.profiles (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  email       text,
  created_at  timestamptz not null default now()
);

create table public.org_members (
  org_id      uuid not null references public.organizations (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  org_role    public.org_role not null default 'member',
  created_at  timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index org_members_user_idx on public.org_members (user_id);

create table public.assessor_credentials (
  user_id                    uuid not null references auth.users (id) on delete cascade,
  association                public.credential_association not null,
  registration_no            text not null check (length(btrim(registration_no)) > 0),
  good_standing_attested_at  timestamptz,
  primary key (user_id, association)
);

-- ---------------------------------------------------------------- sites and access
create table public.sites (
  id               uuid primary key default gen_random_uuid(),
  licensee_org_id  uuid not null references public.organizations (id) on delete restrict,
  site_type        public.site_type not null,
  is_landfill      boolean not null default false,     -- Req. 14-15
  licence_no       text,                               -- null = "NEW" (F035)
  lsd              text,                               -- legal land description
  site_name        text,
  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now()
);
create index sites_licensee_idx on public.sites (licensee_org_id);

create table public.site_grants (
  id              uuid primary key default gen_random_uuid(),
  site_id         uuid not null references public.sites (id) on delete cascade,
  grantee_org_id  uuid not null references public.organizations (id) on delete cascade,
  role            public.grant_role not null,
  granted_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  unique (site_id, grantee_org_id, role)
);
create index site_grants_grantee_idx on public.site_grants (grantee_org_id);

-- ---------------------------------------------------------------- assessments and workstreams
create table public.assessments (
  id               uuid primary key default gen_random_uuid(),
  site_id          uuid not null references public.sites (id) on delete cascade,
  version_no       integer not null default 1,
  assessment_date  date,
  status           public.assessment_status not null default 'draft',
  limitations_text text,                                -- Req. 48
  locked_at        timestamptz,
  created_at       timestamptz not null default now(),
  unique (site_id, version_no)
);

create table public.personnel (                          -- Req. 51
  id                  uuid primary key default gen_random_uuid(),
  assessment_id       uuid not null references public.assessments (id) on delete cascade,
  name                text not null,
  role                text not null,
  technical_training  text,
  experience          text
);
create index personnel_assessment_idx on public.personnel (assessment_id);

create table public.workstreams (
  id             uuid primary key default gen_random_uuid(),
  assessment_id  uuid not null references public.assessments (id) on delete cascade,
  kind           public.workstream_kind not null,
  applicable     boolean not null default true,
  na_rationale   text,
  status         public.workstream_status not null default 'not_started',
  created_at     timestamptz not null default now(),
  unique (assessment_id, kind)
);

create table public.workstream_assignments (
  id             uuid primary key default gen_random_uuid(),
  workstream_id  uuid not null references public.workstreams (id) on delete cascade,
  org_id         uuid not null references public.organizations (id) on delete cascade,
  user_id        uuid references auth.users (id) on delete cascade,   -- null = whole org
  assigned_by    uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  unique (workstream_id, org_id)
);
create index workstream_assignments_org_idx on public.workstream_assignments (org_id);

create table public.workstream_details (
  workstream_id   uuid primary key references public.workstreams (id) on delete cascade,
  schema_version  integer not null default 1,
  data            jsonb not null default '{}'::jsonb,
  updated_at      timestamptz not null default now(),
  updated_by      uuid references auth.users (id) on delete set null
);

-- ---------------------------------------------------------------- files
create table public.rate_sheets (
  id               uuid primary key default gen_random_uuid(),
  site_id          uuid not null references public.sites (id) on delete cascade,
  uploaded_by_org  uuid not null references public.organizations (id) on delete cascade,
  uploaded_by      uuid references auth.users (id) on delete set null,
  vendor           text,
  title            text not null,
  effective_date   date,
  storage_path     text not null unique,
  discount_type    public.discount_type not null default 'none',
  shared           boolean not null default false,    -- visible to all granted contractors
  created_at       timestamptz not null default now()
);
create index rate_sheets_site_idx on public.rate_sheets (site_id);

create table public.documents (
  id               uuid primary key default gen_random_uuid(),
  site_id          uuid not null references public.sites (id) on delete cascade,
  assessment_id    uuid references public.assessments (id) on delete cascade,
  workstream_id    uuid references public.workstreams (id) on delete set null,
  uploaded_by_org  uuid not null references public.organizations (id) on delete cascade,
  uploaded_by      uuid references auth.users (id) on delete set null,
  kind             public.document_kind not null,
  title            text not null,
  storage_path     text not null unique,
  created_at       timestamptz not null default now()
);
create index documents_site_idx on public.documents (site_id);
create index documents_workstream_idx on public.documents (workstream_id);

-- ---------------------------------------------------------------- cost line items (Req. 2c)
create table public.cost_line_items (
  id                    uuid primary key default gen_random_uuid(),
  workstream_id         uuid not null references public.workstreams (id) on delete cascade,
  form_ref              public.form_ref not null,
  form_row_key          text,   -- key from src/lib/forms/templateMap.ts, e.g. '001-A:concrete_demolition'
  cost_category         public.cost_category not null default 'other',
  task                  text not null default '',
  calc_mode             public.calc_mode not null default 'qty_x_rate',
  quantity              numeric(18, 4),
  unit                  text,
  unit_rate             numeric(18, 4),
  -- money is never computed in app code: the database owns the arithmetic
  total                 numeric(14, 2) generated always as
                          (round(coalesce(quantity, 0) * coalesce(unit_rate, 0), 2)) stored,
  rate_sheet_id         uuid references public.rate_sheets (id) on delete set null,
  rate_sheet_ref        text,   -- page / line in the rate sheet
  discount_pct_applied  numeric(7, 4),   -- must stay null (Req. 4); the rule engine blocks any value
  escalation_pct_applied numeric(7, 4),  -- must stay null (Req. 3-4)
  contingency_kind      public.contingency_kind,
  rationale             text,
  supporting_document_id uuid references public.documents (id) on delete set null,
  notes                 text,
  sort_order            integer not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check (form_row_key is null or form_row_key like form_ref::text || ':%')
);
create index cost_line_items_ws_idx on public.cost_line_items (workstream_id);
create index cost_line_items_rate_sheet_idx on public.cost_line_items (rate_sheet_id);

-- ---------------------------------------------------------------- review / sign-off / audit
create table public.comments (
  id             uuid primary key default gen_random_uuid(),
  workstream_id  uuid not null references public.workstreams (id) on delete cascade,
  line_item_id   uuid references public.cost_line_items (id) on delete set null,
  author_id      uuid not null references auth.users (id) on delete restrict,
  body           text not null check (length(btrim(body)) > 0),
  resolved_at    timestamptz,
  created_at     timestamptz not null default now()
);
create index comments_ws_idx on public.comments (workstream_id);

create table public.review_events (
  id             uuid primary key default gen_random_uuid(),
  workstream_id  uuid not null references public.workstreams (id) on delete cascade,
  actor_id       uuid references auth.users (id) on delete set null,
  action         public.review_action not null,
  from_status    public.workstream_status not null,
  to_status      public.workstream_status not null,
  reason         text,
  created_at     timestamptz not null default now()
);
create index review_events_ws_idx on public.review_events (workstream_id);

create table public.signoffs (                           -- Req. 52-57
  id                    uuid primary key default gen_random_uuid(),
  assessment_id         uuid not null references public.assessments (id) on delete cascade,
  statement             public.signoff_statement not null,
  assessor_user_id      uuid not null references auth.users (id) on delete restrict,
  credentials_snapshot  jsonb not null,
  statement_text_version text not null,
  signed_at             timestamptz not null default now(),
  unique (assessment_id, statement)
);

create table public.package_exports (
  id             uuid primary key default gen_random_uuid(),
  assessment_id  uuid not null references public.assessments (id) on delete cascade,
  storage_path   text not null,
  manifest       jsonb not null default '{}'::jsonb,
  generated_by   uuid references auth.users (id) on delete set null,
  generated_at   timestamptz not null default now()
);

create table public.audit_log (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  actor       uuid,              -- null = service role / system
  site_id     uuid,              -- no FK on purpose: the log must outlive the rows it describes
  org_id      uuid,
  action      text not null,     -- INSERT | UPDATE | DELETE
  table_name  text not null,
  record_id   text,
  before      jsonb,
  after       jsonb
);
create index audit_log_site_idx on public.audit_log (site_id, at desc);
create index audit_log_org_idx on public.audit_log (org_id, at desc);
