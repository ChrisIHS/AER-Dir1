-- Org isolation (docs/PLAN.md section 2). Run with: npm run db:test
begin;
select no_plan();

-- Shared fixture, pasted at the top of each *.test.sql (pg_prove runs files independently, so
-- there is no include mechanism). Keep both copies identical.
--
--   Licensee L  (o1): u1 admin, u2 member           Site S1 (s1) owned by L
--   Contractor A (o2): u3                           A: contractor grant on S1, assigned 'abandonment'
--   Contractor B (o3): u4                           B: contractor grant on S1, assigned 'reclamation'
--   Assessor firm F (o4): u5                        F: lead_assessor grant on S1
--   Licensee O  (o5): u6 admin (outsider)           Site S2 (s2) owned by O

create schema tests;
grant usage on schema tests to anon, authenticated;

create function tests.act_as(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

create function tests.act_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
end $$;

create function tests.act_admin() returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;

-- workstream lookup that ignores RLS (test code only)
create function tests.ws(p_site uuid, p_kind public.workstream_kind) returns uuid
language sql stable security definer as $$
  select w.id from public.workstreams w join public.assessments a on a.id = w.assessment_id
  where a.site_id = p_site and w.kind = p_kind;
$$;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lic.admin@example.test', '{}'),
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lic.member@example.test', '{}'),
  ('00000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'con.a@example.test', '{}'),
  ('00000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'con.b@example.test', '{}'),
  ('00000000-0000-4000-8000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'assessor@example.test', '{}'),
  ('00000000-0000-4000-8000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'outsider@example.test', '{}');

insert into public.organizations (id, name, kind) values
  ('a0000000-0000-4000-8000-000000000001', 'Test Licensee L', 'licensee'),
  ('a0000000-0000-4000-8000-000000000002', 'Test Contractor A', 'contractor'),
  ('a0000000-0000-4000-8000-000000000003', 'Test Contractor B', 'contractor'),
  ('a0000000-0000-4000-8000-000000000004', 'Test Assessor Firm F', 'assessor_firm'),
  ('a0000000-0000-4000-8000-000000000005', 'Test Licensee O', 'licensee');

insert into public.org_members (org_id, user_id, org_role) values
  ('a0000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'admin'),
  ('a0000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'member'),
  ('a0000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003', 'admin'),
  ('a0000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000004', 'admin'),
  ('a0000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000005', 'admin'),
  ('a0000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000006', 'admin');

insert into public.sites (id, licensee_org_id, site_type, licence_no, lsd, site_name) values
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'well', 'TEST-0001', '00/01-01-001-01W5/0', 'S1 test well'),
  ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000005', 'facility', 'TEST-0002', '01-02-002-02W5', 'S2 other licensee');

insert into public.site_grants (site_id, grantee_org_id, role) values
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'contractor'),
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003', 'contractor'),
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000004', 'lead_assessor');

insert into public.workstream_assignments (workstream_id, org_id) values
  (tests.ws('b0000000-0000-4000-8000-000000000001', 'abandonment'), 'a0000000-0000-4000-8000-000000000002'),
  (tests.ws('b0000000-0000-4000-8000-000000000001', 'reclamation'), 'a0000000-0000-4000-8000-000000000003');

update public.workstreams set status = 'in_progress'
 where id in (tests.ws('b0000000-0000-4000-8000-000000000001', 'abandonment'),
              tests.ws('b0000000-0000-4000-8000-000000000001', 'reclamation'));

insert into public.rate_sheets (id, site_id, uploaded_by_org, uploaded_by, title, storage_path) values
  ('d0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003', 'A rate sheet',
   'a0000000-0000-4000-8000-000000000002/b0000000-0000-4000-8000-000000000001/rates.pdf');

insert into public.cost_line_items (id, workstream_id, form_ref, form_row_key, task, quantity, unit, unit_rate) values
  ('c0000000-0000-4000-8000-000000000001', tests.ws('b0000000-0000-4000-8000-000000000001', 'abandonment'),
   '001-A', '001-A:concrete_demolition', 'A line', 2.5, 't', 100.123),
  ('c0000000-0000-4000-8000-000000000002', tests.ws('b0000000-0000-4000-8000-000000000001', 'reclamation'),
   '001-B', '001-B:decompaction', 'B line', 4, 'ha', 250);

-- =============================================================== Contractor A
select tests.act_as('00000000-0000-4000-8000-000000000003');

select is((select count(*) from public.workstreams), 1::bigint, 'A sees only its one assigned workstream');
select is((select kind::text from public.workstreams), 'abandonment', 'A sees the abandonment workstream');
select is((select count(*) from public.cost_line_items), 1::bigint, 'A sees only its own line item');
select is_empty($$ select 1 from public.cost_line_items where id = 'c0000000-0000-4000-8000-000000000002' $$,
  'A cannot read B''s line item');
select is_empty($$ select 1 from public.workstream_details where workstream_id = tests.ws('b0000000-0000-4000-8000-000000000001', 'reclamation') $$,
  'A cannot read B''s workstream details');
select is_empty($$ update public.cost_line_items set notes = 'hijack' where id = 'c0000000-0000-4000-8000-000000000002' returning id $$,
  'A cannot update B''s line item');
select is_empty($$ delete from public.cost_line_items where id = 'c0000000-0000-4000-8000-000000000002' returning id $$,
  'A cannot delete B''s line item');
select throws_ok($$ insert into public.cost_line_items (workstream_id, form_ref, task, quantity, unit_rate)
    values (tests.ws('b0000000-0000-4000-8000-000000000001', 'reclamation'), '001-B', 'smuggled', 1, 1) $$,
  '42501', null, 'A cannot insert a line item into B''s workstream');
select throws_ok($$ insert into public.cost_line_items (workstream_id, form_ref, task, quantity, unit_rate)
    values (tests.ws('b0000000-0000-4000-8000-000000000001', 'care_security'), '001-A', 'unassigned', 1, 1) $$,
  '42501', null, 'A cannot insert into a workstream it is not assigned to');
select lives_ok($$ insert into public.cost_line_items (workstream_id, form_ref, task, quantity, unit_rate)
    values (tests.ws('b0000000-0000-4000-8000-000000000001', 'abandonment'), '001-A', 'own work', 1, 1) $$,
  'A can insert into its assigned workstream');
select is((select count(*) from public.rate_sheets), 1::bigint, 'A sees the rate sheet it uploaded');
select is((select count(*) from public.sites), 1::bigint, 'A sees the one site it is granted on');
select is((select count(*) from public.assessments), 0::bigint, 'A cannot read assessments');
select is((select count(*) from public.organizations), 2::bigint, 'A sees only its own org and the licensee (not B, F or O)');
select is((select count(*) from public.site_grants), 1::bigint, 'A sees only its own grant');
select is((select count(*) from public.audit_log where site_id is not null), 0::bigint, 'A cannot read any site audit rows');
select is((select count(*) from public.audit_log where org_id is not null and org_id <> 'a0000000-0000-4000-8000-000000000002'), 0::bigint,
  'A sees audit rows only for its own organization');
select throws_ok($$ insert into public.site_grants (site_id, grantee_org_id, role)
    values ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'lead_assessor') $$,
  '42501', null, 'A cannot grant itself the lead_assessor role');
select throws_ok($$ insert into public.sites (licensee_org_id, site_type)
    values ('a0000000-0000-4000-8000-000000000001', 'well') $$,
  '42501', null, 'A cannot create a site under the licensee org');
select throws_ok($$ insert into public.org_members (org_id, user_id, org_role)
    values ('a0000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003', 'admin') $$,
  '42501', null, 'A cannot add itself to the licensee org');
select throws_ok($$ update public.workstreams set status = 'approved'
    where id = tests.ws('b0000000-0000-4000-8000-000000000001', 'abandonment') $$,
  '42501', null, 'A cannot change a workstream status directly');
select throws_ok($$ insert into public.audit_log (action, table_name) values ('INSERT', 'forged') $$,
  '42501', null, 'A cannot write to the audit log');

-- storage uploads
select lives_ok($$ insert into storage.objects (bucket_id, name)
    values ('site-files', 'a0000000-0000-4000-8000-000000000002/b0000000-0000-4000-8000-000000000001/own.pdf') $$,
  'A can upload under its own org and a site it has access to');
select throws_ok($$ insert into storage.objects (bucket_id, name)
    values ('site-files', 'a0000000-0000-4000-8000-000000000003/b0000000-0000-4000-8000-000000000001/spoof.pdf') $$,
  '42501', null, 'A cannot upload under B''s org folder');
select throws_ok($$ insert into storage.objects (bucket_id, name)
    values ('site-files', 'a0000000-0000-4000-8000-000000000002/b0000000-0000-4000-8000-000000000002/other.pdf') $$,
  '42501', null, 'A cannot upload to a site it has no access to');

-- =============================================================== Contractor B
select tests.act_as('00000000-0000-4000-8000-000000000004');
select is((select count(*) from public.workstreams), 1::bigint, 'B sees only its one assigned workstream');
select is((select kind::text from public.workstreams), 'reclamation', 'B sees the reclamation workstream');
select is((select count(*) from public.cost_line_items), 1::bigint, 'B sees only its own line item');
select is((select count(*) from public.rate_sheets), 0::bigint, 'B cannot see A''s unshared rate sheet');

select tests.act_admin();
update public.rate_sheets set shared = true where id = 'd0000000-0000-4000-8000-000000000001';
select tests.act_as('00000000-0000-4000-8000-000000000004');
select is((select count(*) from public.rate_sheets), 1::bigint, 'B sees A''s rate sheet once it is shared on the site');

-- =============================================================== Lead assessor
select tests.act_as('00000000-0000-4000-8000-000000000005');
select is((select count(*) from public.workstreams), 7::bigint, 'assessor sees all seven workstreams');
select is((select count(*) from public.cost_line_items), 3::bigint, 'assessor sees every line item on the site');
select is((select count(*) from public.organizations), 4::bigint, 'assessor sees F, L, A and B (not O)');
select lives_ok($$ insert into public.comments (workstream_id, author_id, body)
    values (tests.ws('b0000000-0000-4000-8000-000000000001', 'abandonment'),
            '00000000-0000-4000-8000-000000000005', 'Please add the rate sheet page ref') $$,
  'assessor can comment');
select throws_ok($$ insert into public.comments (workstream_id, author_id, body)
    values (tests.ws('b0000000-0000-4000-8000-000000000001', 'abandonment'),
            '00000000-0000-4000-8000-000000000003', 'impersonated') $$,
  '42501', null, 'assessor cannot write a comment as someone else');
select is_empty($$ update public.cost_line_items set notes = 'edit' where id = 'c0000000-0000-4000-8000-000000000001' returning id $$,
  'assessor cannot edit line items');
select ok((select count(*) from public.audit_log) > 0, 'assessor can read the site audit log');

-- =============================================================== Licensee admin / member
select tests.act_as('00000000-0000-4000-8000-000000000001');
select is((select count(*) from public.workstreams), 7::bigint, 'licensee admin sees all workstreams');
select is((select count(*) from public.sites), 1::bigint, 'licensee admin sees only its own site (not S2)');
select is((select count(*) from public.rate_sheets), 1::bigint, 'licensee sees the site rate sheet');
select ok((select count(*) from public.audit_log) > 0, 'licensee admin can read the audit log');
select is_empty($$ select 1 from public.sites where id = 'b0000000-0000-4000-8000-000000000002' $$,
  'licensee admin cannot see another licensee''s site');
select lives_ok($$ insert into public.site_grants (site_id, grantee_org_id, role)
    values ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'lead_assessor') $$,
  'licensee admin can grant access on its site');
select throws_ok($$ insert into public.site_grants (site_id, grantee_org_id, role)
    values ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'contractor') $$,
  '23514', null, 'licensee cannot grant its own site to itself');

select tests.act_as('00000000-0000-4000-8000-000000000002');
select is((select count(*) from public.workstreams), 7::bigint, 'licensee member sees all workstreams');
select is((select count(*) from public.audit_log), 0::bigint, 'licensee member (non-admin) cannot read the audit log');
select throws_ok($$ insert into public.site_grants (site_id, grantee_org_id, role)
    values ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003', 'lead_assessor') $$,
  '42501', null, 'licensee member (non-admin) cannot grant access');

-- =============================================================== Outsider (other licensee)
select tests.act_as('00000000-0000-4000-8000-000000000006');
select is((select count(*) from public.sites), 1::bigint, 'outsider sees only its own site');
select is_empty($$ select 1 from public.workstreams w join public.assessments a on a.id = w.assessment_id
                   where a.site_id = 'b0000000-0000-4000-8000-000000000001' $$,
  'outsider sees no workstreams of S1');
select is((select count(*) from public.cost_line_items), 0::bigint, 'outsider sees no line items');
select is((select count(*) from public.rate_sheets), 0::bigint, 'outsider sees no rate sheets');
select throws_ok($$ insert into public.org_members (org_id, user_id, org_role)
    values ('a0000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000006', 'admin') $$,
  '42501', null, 'outsider cannot join the licensee org');
select is_empty($$ select 1 from public.profiles where user_id = '00000000-0000-4000-8000-000000000003' $$,
  'outsider cannot read an unrelated user''s profile');

-- =============================================================== Anonymous
select tests.act_anon();
select throws_ok($$ select count(*) from public.sites $$, '42501', null, 'anon has no table privileges');
select throws_ok($$ select public.create_organization('x', 'licensee') $$, '42501', null, 'anon cannot call create_organization');

select tests.act_admin();
select * from finish();
rollback;
