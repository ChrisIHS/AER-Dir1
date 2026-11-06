-- Demo data: FICTIONAL ONLY. Runs after migrations on `supabase db reset`.
--
--   Prairie Ridge Energy Ltd. (licensee)         admin@demo.test
--   Northern Abandonment Services (contractor)    contractor.a@demo.test   -> abandonment, suspension, care_security
--   Foothills Environmental Consulting (contractor) contractor.b@demo.test -> esa_remediation, reclamation
--   Summit Liability Assessors (assessor firm)    assessor@demo.test
--   All demo users share the password set below (local development only).
--
--   Site 1  Well      mostly complete: two deliberate blockers (bulking factor 1.5 unjustified; one line with no rate sheet)
--   Site 2  Pipeline  half done: one segment with no abandon-in-place / removed decision, only 2 years of security
--   Site 3  Facility  nearly empty: shows the all-red tracker
--
-- Documents and rate sheets point at storage paths that do not exist in the bucket (no files are seeded).

create function pg_temp.mk_user(p_id uuid, p_email text, p_name text) returns void language plpgsql as $$
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', p_email,
    extensions.crypt('demo-password-1', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', json_build_object('full_name', p_name)::jsonb, now(), now(),
    '', '', '', '', '', '', '', ''
  );
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), p_id, p_id::text, json_build_object('sub', p_id::text, 'email', p_email)::jsonb, 'email', now(), now(), now());
end $$;

create function pg_temp.ws(p_site uuid, p_kind public.workstream_kind) returns uuid language sql stable as $$
  select w.id from public.workstreams w join public.assessments a on a.id = w.assessment_id
  where a.site_id = p_site and w.kind = p_kind;
$$;

create function pg_temp.det(p_site uuid, p_kind public.workstream_kind, p_data jsonb) returns void language sql as $$
  update public.workstream_details set data = p_data where workstream_id = pg_temp.ws(p_site, p_kind);
$$;

create function pg_temp.li(
  p_site uuid, p_kind public.workstream_kind, p_form public.form_ref, p_row text, p_cat public.cost_category,
  p_task text, p_qty numeric, p_unit text, p_rate numeric,
  p_rs uuid default null, p_ref text default null, p_req5 text default null,
  p_ck public.contingency_kind default null, p_rationale text default null, p_doc uuid default null,
  p_mode public.calc_mode default 'qty_x_rate'
) returns void language sql as $$
  insert into public.cost_line_items (workstream_id, form_ref, form_row_key, cost_category, task, calc_mode, quantity, unit,
    unit_rate, rate_sheet_id, rate_sheet_ref, req5_item, contingency_kind, rationale, supporting_document_id)
  values (pg_temp.ws(p_site, p_kind), p_form, p_row, p_cat, p_task, p_mode, p_qty, p_unit, p_rate, p_rs, p_ref, p_req5, p_ck, p_rationale, p_doc);
$$;

-- ---------------------------------------------------------------- users and orgs
select pg_temp.mk_user('11111111-0000-4000-8000-000000000001', 'admin@demo.test', 'Dana Admin');
select pg_temp.mk_user('11111111-0000-4000-8000-000000000002', 'contractor.a@demo.test', 'Casey Abandonment');
select pg_temp.mk_user('11111111-0000-4000-8000-000000000003', 'contractor.b@demo.test', 'Bailey Environmental');
select pg_temp.mk_user('11111111-0000-4000-8000-000000000004', 'assessor@demo.test', 'Alex Assessor');

insert into public.organizations (id, name, kind, ba_id, created_by) values
  ('22222222-0000-4000-8000-000000000001', 'Prairie Ridge Energy Ltd.', 'licensee', 'DEMO-BA-0001', '11111111-0000-4000-8000-000000000001'),
  ('22222222-0000-4000-8000-000000000002', 'Northern Abandonment Services', 'contractor', null, '11111111-0000-4000-8000-000000000002'),
  ('22222222-0000-4000-8000-000000000003', 'Foothills Environmental Consulting', 'contractor', null, '11111111-0000-4000-8000-000000000003'),
  ('22222222-0000-4000-8000-000000000004', 'Summit Liability Assessors', 'assessor_firm', null, '11111111-0000-4000-8000-000000000004');

insert into public.org_members (org_id, user_id, org_role) values
  ('22222222-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000001', 'admin'),
  ('22222222-0000-4000-8000-000000000002', '11111111-0000-4000-8000-000000000002', 'admin'),
  ('22222222-0000-4000-8000-000000000003', '11111111-0000-4000-8000-000000000003', 'admin'),
  ('22222222-0000-4000-8000-000000000004', '11111111-0000-4000-8000-000000000004', 'admin');

insert into public.assessor_credentials (user_id, association, registration_no, good_standing_attested_at) values
  ('11111111-0000-4000-8000-000000000004', 'APEGA', 'DEMO-12345', now());

-- ---------------------------------------------------------------- sites, grants, assignments
insert into public.sites (id, licensee_org_id, site_type, licence_no, lsd, site_name, created_by) values
  ('33333333-0000-4000-8000-000000000001', '22222222-0000-4000-8000-000000000001', 'well', 'DEMO-W-0001', '00/06-12-045-08W5/0', 'Demo 6-12 Oil Well', '11111111-0000-4000-8000-000000000001'),
  ('33333333-0000-4000-8000-000000000002', '22222222-0000-4000-8000-000000000001', 'pipeline', 'DEMO-P-0001', '06-12-045-08W5 to 14-01-045-07W5', 'Demo 6-12 Flowline', '11111111-0000-4000-8000-000000000001'),
  ('33333333-0000-4000-8000-000000000003', '22222222-0000-4000-8000-000000000001', 'facility', 'DEMO-F-0001', '14-01-045-07W5', 'Demo Battery 12', '11111111-0000-4000-8000-000000000001');

insert into public.site_grants (site_id, grantee_org_id, role, granted_by)
select s.id, o.id, o.r, '11111111-0000-4000-8000-000000000001'
from public.sites s
cross join (values
  ('22222222-0000-4000-8000-000000000002'::uuid, 'contractor'::public.grant_role),
  ('22222222-0000-4000-8000-000000000003'::uuid, 'contractor'::public.grant_role),
  ('22222222-0000-4000-8000-000000000004'::uuid, 'lead_assessor'::public.grant_role)
) as o(id, r);

insert into public.workstream_assignments (workstream_id, org_id, assigned_by)
select pg_temp.ws(s.id, a.kind), a.org, '11111111-0000-4000-8000-000000000001'
from public.sites s
cross join (values
  ('care_security'::public.workstream_kind, '22222222-0000-4000-8000-000000000002'::uuid),
  ('suspension', '22222222-0000-4000-8000-000000000002'),
  ('abandonment', '22222222-0000-4000-8000-000000000002'),
  ('esa_remediation', '22222222-0000-4000-8000-000000000003'),
  ('reclamation', '22222222-0000-4000-8000-000000000003')
) as a(kind, org);

-- ---------------------------------------------------------------- rate sheets and documents (site 1 and 2)
insert into public.rate_sheets (id, site_id, uploaded_by_org, uploaded_by, vendor, title, effective_date, storage_path, discount_type) values
  ('44444444-0000-4000-8000-000000000001', '33333333-0000-4000-8000-000000000001', '22222222-0000-4000-8000-000000000002', '11111111-0000-4000-8000-000000000002',
   'Northern Abandonment Services', 'NAS 2026 published rates', '2026-06-01',
   '22222222-0000-4000-8000-000000000002/33333333-0000-4000-8000-000000000001/nas-2026-rates.pdf', 'none'),
  ('44444444-0000-4000-8000-000000000002', '33333333-0000-4000-8000-000000000001', '22222222-0000-4000-8000-000000000003', '11111111-0000-4000-8000-000000000003',
   'Foothills Environmental', 'Foothills 2026 rate card', '2026-05-15',
   '22222222-0000-4000-8000-000000000003/33333333-0000-4000-8000-000000000001/foothills-2026-rates.pdf', 'none'),
  ('44444444-0000-4000-8000-000000000003', '33333333-0000-4000-8000-000000000002', '22222222-0000-4000-8000-000000000002', '11111111-0000-4000-8000-000000000002',
   'Northern Abandonment Services', 'NAS 2026 published rates', '2026-06-01',
   '22222222-0000-4000-8000-000000000002/33333333-0000-4000-8000-000000000002/nas-2026-rates.pdf', 'none');

insert into public.documents (id, site_id, assessment_id, workstream_id, uploaded_by_org, uploaded_by, kind, title, storage_path)
select d.id, d.site, a.id, pg_temp.ws(d.site, d.ws), d.org, d.usr, d.kind, d.title,
       d.org::text || '/' || d.site::text || '/' || d.file
from (values
  ('55555555-0000-4000-8000-000000000001'::uuid, '33333333-0000-4000-8000-000000000001'::uuid, 'suspension'::public.workstream_kind, '22222222-0000-4000-8000-000000000002'::uuid, '11111111-0000-4000-8000-000000000002'::uuid, 'suspension_plan'::public.document_kind, 'Suspension plan', 'suspension-plan.pdf'),
  ('55555555-0000-4000-8000-000000000002', '33333333-0000-4000-8000-000000000001', 'abandonment', '22222222-0000-4000-8000-000000000002', '11111111-0000-4000-8000-000000000002', 'abandonment_plan', 'Abandonment plan', 'abandonment-plan.pdf'),
  ('55555555-0000-4000-8000-000000000003', '33333333-0000-4000-8000-000000000001', 'abandonment', '22222222-0000-4000-8000-000000000002', '11111111-0000-4000-8000-000000000002', 'scrap_support', 'Recycler price list', 'scrap-prices.pdf'),
  ('55555555-0000-4000-8000-000000000004', '33333333-0000-4000-8000-000000000001', 'esa_remediation', '22222222-0000-4000-8000-000000000003', '11111111-0000-4000-8000-000000000003', 'site_drawing', 'Site drawing with sample points', 'site-drawing.pdf'),
  ('55555555-0000-4000-8000-000000000005', '33333333-0000-4000-8000-000000000001', 'esa_remediation', '22222222-0000-4000-8000-000000000003', '11111111-0000-4000-8000-000000000003', 'remediation_plan', 'Remediation plan', 'remediation-plan.pdf'),
  ('55555555-0000-4000-8000-000000000006', '33333333-0000-4000-8000-000000000001', 'reclamation', '22222222-0000-4000-8000-000000000003', '11111111-0000-4000-8000-000000000003', 'reclamation_plan', 'Reclamation plan', 'reclamation-plan.pdf'),
  ('55555555-0000-4000-8000-000000000007', '33333333-0000-4000-8000-000000000002', 'suspension', '22222222-0000-4000-8000-000000000002', '11111111-0000-4000-8000-000000000002', 'discontinuation_plan', 'Discontinuation plan', 'discontinuation-plan.pdf')
) as d(id, site, ws, org, usr, kind, title, file)
join public.assessments a on a.site_id = d.site;

-- ================================================================ SITE 1: WELL (mostly complete)
select pg_temp.det('33333333-0000-4000-8000-000000000001', k, '{"attestations":{"noNpvDiscount":true}}'::jsonb)
from unnest(array['care_security','suspension','contingencies']::public.workstream_kind[]) as k;

select pg_temp.det('33333333-0000-4000-8000-000000000001', 'abandonment', '{"attestations":{"noNpvDiscount":true},"pipelineSegments":[]}');
select pg_temp.det('33333333-0000-4000-8000-000000000001', 'reclamation',
  '{"attestations":{"noNpvDiscount":true},"elementsAddressed":["a","b","c","d","e","f","g","h","i","j"]}');
select pg_temp.det('33333333-0000-4000-8000-000000000001', 'mgmt_admin', '{"attestations":{"noNpvDiscount":true}}');
select pg_temp.det('33333333-0000-4000-8000-000000000001', 'esa_remediation', $j${
  "attestations": {"noNpvDiscount": true},
  "phase1OnestopId": "DEMO-P1-0001", "phase2OnestopId": "DEMO-P2-0001", "roscOnestopId": null,
  "remediationApproach": "tier1",
  "apecs": [{"id": "apec-1", "description": "Former tank area"}],
  "offSiteDisposalPlanned": true,
  "volumes": {"affectedInSituM3": 1000, "topsoilOverburdenM3": 500, "plumeIrregularityFactor": 1.1,
              "plumeBasis": "Plume fingers observed in BH-3 and BH-7",
              "bulkingFactor": 1.5, "bulkingBasis": "Pilot pit", "bulkingJustification": null,
              "soilDensityTPerM3": 1.8, "moisturePct": 12, "densityMethod": "Shelby tube samples"}
}$j$);

do $$
declare
  s1  uuid := '33333333-0000-4000-8000-000000000001';
  rs1 uuid := '44444444-0000-4000-8000-000000000001';  -- Northern Abandonment Services rates
  rs2 uuid := '44444444-0000-4000-8000-000000000002';  -- Foothills rates
  doc_scrap uuid := '55555555-0000-4000-8000-000000000003';
  r5 text[] := array['a','b','c','d','e','f','g','h','i','j'];
  r5_task text[] := array['Initial planning','Regulatory applications and approvals','On-site supervision','Reporting',
    'Overall project coordination','Subcontractors and third-party services','Equipment rental','Consumable supplies',
    'Mobilization time and travel expenses','Subsistence'];
  i int;
begin
  perform pg_temp.li(s1,'care_security','001-A','001-A:additional_reasonable_care_and_measures_and_security_3_years','care','Reasonable care and measures',3,'year',12000,rs1,'p. 4');
  perform pg_temp.li(s1,'care_security','001-A','001-A:additional_reasonable_care_and_measures_and_security_3_years','security','Site security (weekly inspections)',36,'month',700,rs1,'p. 5');
  perform pg_temp.li(s1,'suspension','001-A','001-A:facility_suspension_purge_vessels_flow_lines','suspension','Purge and isolate flow lines',1,'ls',5000,rs1,'p. 6');
  perform pg_temp.li(s1,'abandonment','001-A','001-A:concrete_demolition','demolition','Concrete pad removal',20,'t',150,rs1,'p. 7');
  perform pg_temp.li(s1,'abandonment','001-A','001-A:class_ii_landfill__disposal_fee','transport_disposal','Class II landfill disposal',15,'t',80,rs1,'p. 9');
  perform pg_temp.li(s1,'abandonment','001-A','001-A:ferrous_material_value','scrap_metal','Ferrous scrap value',5,'t',200,rs1,'p. 12',null,null,null,doc_scrap);

  perform pg_temp.li(s1,'esa_remediation','001-B','001-B:phase_1','esa','Phase 1 ESA',1,'ls',8000,rs2,'p. 2');
  perform pg_temp.li(s1,'esa_remediation','001-B','001-B:phase_2','esa','Phase 2 ESA',1,'ls',40000,rs2,'p. 2');
  perform pg_temp.li(s1,'esa_remediation','001-B','001-B:class_ii_landfill__disposal_fee','remediation_off_site','Class II disposal of affected soil',1800,'t',85,rs2,'p. 3');
  perform pg_temp.li(s1,'esa_remediation','001-B','001-B:purchase_and_delivery','backfill_import','Backfill purchase and delivery',1000,'t',22,rs2,'p. 4');
  perform pg_temp.li(s1,'esa_remediation','001-B','001-B:placement_and_compaction','backfill_import','Backfill placement and compaction',1000,'t',9,rs2,'p. 4');
  perform pg_temp.li(s1,'esa_remediation','001-B','001-B:equipment_including_mob_demob','overburden_topsoil_handling','Strip and replace overburden',1,'ls',15000,rs2,'p. 5');
  perform pg_temp.li(s1,'reclamation','001-B','001-B:topsoil_purchase_delivery_and_placement','reclamation','Topsoil placement',1.2,'ha',9000,rs2,'p. 6');

  perform pg_temp.li(s1,'contingencies','001-A','001-A:contingency','contingency','General contingency',0.1,'%',100000,null,null,null,'general',
    'Ten percent for unforeseen site conditions.',null,'percent_of_base');

  for i in 1..10 loop
    -- deliberate blocker: item (e) has no rate sheet
    perform pg_temp.li(s1,'mgmt_admin','001-A','001-A:site_admin_costs_supervision_safety_utilities_trailers_taxes_etc','project_management',
      r5_task[i],1,'ls',1000, case when r5[i] = 'e' then null else rs1 end, case when r5[i] = 'e' then null else 'p. 14' end, r5[i]);
  end loop;

  update public.workstreams set status = v.st
  from (values ('care_security'::public.workstream_kind,'approved'::public.workstream_status),
               ('suspension','approved'), ('abandonment','submitted'), ('esa_remediation','in_progress'),
               ('reclamation','in_progress'), ('mgmt_admin','in_progress')) as v(kind, st)
  where workstreams.kind = v.kind and workstreams.assessment_id = (select id from public.assessments where site_id = s1);
end $$;

-- ================================================================ SITE 2: PIPELINE (half done)
select pg_temp.det('33333333-0000-4000-8000-000000000002', k, '{"attestations":{"noNpvDiscount":true}}'::jsonb)
from unnest(array['care_security','suspension','esa_remediation','reclamation','contingencies','mgmt_admin']::public.workstream_kind[]) as k;
select pg_temp.det('33333333-0000-4000-8000-000000000002', 'abandonment', $j${
  "attestations": {"noNpvDiscount": true},
  "pipelineSegments": [
    {"id": "seg-1", "label": "6-12 to 11-12 (4.2 km)", "method": "removed"},
    {"id": "seg-2", "label": "11-12 to 14-01 (3.1 km)", "method": null}
  ]
}$j$);

do $$
declare
  s2  uuid := '33333333-0000-4000-8000-000000000002';
  rs3 uuid := '44444444-0000-4000-8000-000000000003';
begin
  perform pg_temp.li(s2,'care_security','001-A','001-A:additional_reasonable_care_and_measures_and_security_3_years','care','Corrosion control and monitoring',3,'year',9000,rs3,'p. 4');
  -- deliberate blocker: only 24 months of security (Req. 8 needs 36)
  perform pg_temp.li(s2,'care_security','001-A','001-A:additional_reasonable_care_and_measures_and_security_3_years','security','Right-of-way patrols',24,'month',600,rs3,'p. 5');
  perform pg_temp.li(s2,'suspension','001-A','001-A:facility_suspension_purge_vessels_flow_lines','suspension','Isolate, clean and purge line',1,'ls',18000,rs3,'p. 6');
  perform pg_temp.li(s2,'abandonment','001-A','001-A:belowground_facilities_piping_tanks_demolition','abandonment','Remove segment 1 pipe',40,'t',300,rs3,'p. 8');
  perform pg_temp.li(s2,'mgmt_admin','001-A','001-A:project_management_services','project_management','Initial planning',1,'ls',2500,rs3,'p. 14','a');
  perform pg_temp.li(s2,'mgmt_admin','001-A','001-A:project_management_services','project_management','Regulatory applications',1,'ls',1500,rs3,'p. 14','b');
  perform pg_temp.li(s2,'mgmt_admin','001-A','001-A:site_admin_costs_supervision_safety_utilities_trailers_taxes_etc','project_management','On-site supervision',1,'ls',6000,rs3,'p. 14','c');

  update public.workstreams set status = v.st
  from (values ('care_security'::public.workstream_kind,'in_progress'::public.workstream_status),
               ('suspension','submitted'), ('abandonment','in_progress'), ('mgmt_admin','in_progress')) as v(kind, st)
  where workstreams.kind = v.kind and workstreams.assessment_id = (select id from public.assessments where site_id = s2);
end $$;

-- ================================================================ SITE 3: FACILITY (nearly empty)
do $$
declare
  s3 uuid := '33333333-0000-4000-8000-000000000003';
begin
  perform pg_temp.li(s3,'care_security','001-A','001-A:additional_reasonable_care_and_measures_and_security_3_years','care','Reasonable care and measures',1,'year',20000);
end $$;

update public.sites set facility_type = 'Oil satellite - multiwell' where id = '33333333-0000-4000-8000-000000000003';
