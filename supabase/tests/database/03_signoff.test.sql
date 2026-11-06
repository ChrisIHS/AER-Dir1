-- Sign-off, report fields and reopening (Phase 2). Run with: npm run db:test
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



-- helpers: put the assessment in a signable state, as the database owner
create function tests.ready() returns void language plpgsql as $$
begin
  update public.workstreams set status = 'approved'
   where assessment_id = (select id from public.assessments where site_id = 'b0000000-0000-4000-8000-000000000001');
  update public.assessments set assessment_date = '2026-11-05', limitations_text = 'Snow cover limited the Phase 2 area.'
   where site_id = 'b0000000-0000-4000-8000-000000000001';
  insert into public.personnel (assessment_id, name, role, technical_training, experience)
   select id, 'Pat Assessor', 'Lead assessor', 'B.Sc. Environmental Science', '12 years of SSLAs'
   from public.assessments where site_id = 'b0000000-0000-4000-8000-000000000001';
end $$;
create function tests.aid() returns uuid language sql stable security definer as $$
  select id from public.assessments where site_id = 'b0000000-0000-4000-8000-000000000001' $$;

-- =============================================================== preconditions
select tests.act_as('00000000-0000-4000-8000-000000000005');
select throws_ok($$ select public.sign_statement(tests.aid(), 'care_susp_aband', '2025-02') $$,
  '23514', null, 'cannot sign while workstreams are not approved');

select tests.act_admin();
select tests.ready();

select tests.act_as('00000000-0000-4000-8000-000000000005');
select throws_ok($$ select public.sign_statement(tests.aid(), 'care_susp_aband', '2025-02') $$,
  '23514', null, 'cannot sign without recorded professional credentials (Req. 53)');

select tests.act_admin();
insert into public.assessor_credentials (user_id, association, registration_no, good_standing_attested_at)
  values ('00000000-0000-4000-8000-000000000005', 'APEGA', 'DEMO-9999', null);
select tests.act_as('00000000-0000-4000-8000-000000000005');
select throws_ok($$ select public.sign_statement(tests.aid(), 'care_susp_aband', '2025-02') $$,
  '23514', null, 'good standing must be attested');

select tests.act_admin();
update public.assessor_credentials set good_standing_attested_at = now() where user_id = '00000000-0000-4000-8000-000000000005';

-- =============================================================== who may sign
select tests.act_as('00000000-0000-4000-8000-000000000001');
select throws_ok($$ select public.sign_statement(tests.aid(), 'care_susp_aband', '2025-02') $$,
  '42501', null, 'the licensee admin cannot sign as lead assessor');
select tests.act_as('00000000-0000-4000-8000-000000000003');
select throws_ok($$ select public.sign_statement(tests.aid(), 'care_susp_aband', '2025-02') $$,
  '42501', null, 'a contractor cannot sign');

select tests.act_as('00000000-0000-4000-8000-000000000005');
select throws_ok($$ insert into public.signoffs (assessment_id, statement, assessor_user_id, credentials_snapshot, statement_text_version)
    values (tests.aid(), 'care_susp_aband', '00000000-0000-4000-8000-000000000005', '{"forged":true}', '2025-02') $$,
  '42501', null, 'sign-offs cannot be inserted directly');

-- =============================================================== signing
select lives_ok($$ select public.sign_statement(tests.aid(), 'care_susp_aband', '2025-02') $$, 'the lead assessor can sign the first statement');
select is((select count(*) from public.signoffs), 1::bigint, 'one sign-off recorded');
select is((select credentials_snapshot -> 'credentials' -> 0 ->> 'association' from public.signoffs limit 1), 'APEGA', 'credentials are snapshotted');
select is((select locked_at is null from public.assessments where id = tests.aid()), true, 'one statement does not lock the assessment');
select throws_ok($$ select public.sign_statement(tests.aid(), 'care_susp_aband', '2025-02') $$,
  '23505', null, 'the same statement cannot be signed twice');
select throws_ok($$ select public.sign_statement(tests.aid(), 'remediation_reclamation', '   ') $$,
  '22023', null, 'a statement version is required');

select lives_ok($$ select public.sign_statement(tests.aid(), 'remediation_reclamation', '2025-02') $$, 'the second statement signs');
select is((select status::text from public.assessments where id = tests.aid()), 'signed', 'both statements sign the assessment');
select is((select locked_at is not null from public.assessments where id = tests.aid()), true, 'and lock it');
select throws_ok($$ select public.update_assessment_report(tests.aid(), '2026-12-01', 'changed after signing') $$,
  '42501', null, 'the report is frozen once signed');

-- locked assessment: no changes by anyone below the owner
select tests.act_as('00000000-0000-4000-8000-000000000003');
select is_empty($$ update public.cost_line_items set notes = 'after sign' where id = 'c0000000-0000-4000-8000-000000000001' returning id $$,
  'line items cannot change after sign-off');

-- =============================================================== reopening
select tests.act_as('00000000-0000-4000-8000-000000000002');
select throws_ok($$ select public.reopen_assessment(tests.aid()) $$, '42501', null, 'a non-admin licensee member cannot reopen');
select tests.act_as('00000000-0000-4000-8000-000000000005');
select throws_ok($$ select public.reopen_assessment(tests.aid()) $$, '42501', null, 'the assessor cannot reopen');
select tests.act_as('00000000-0000-4000-8000-000000000001');
select lives_ok($$ select public.reopen_assessment(tests.aid()) $$, 'the licensee admin can reopen');
select is((select count(*) from public.signoffs), 0::bigint, 'reopening clears the sign-offs');
select is((select locked_at is null from public.assessments where id = tests.aid()), true, 'and unlocks');
select ok((select count(*) from public.audit_log where table_name = 'signoffs' and action = 'DELETE') = 2, 'the removed sign-offs stay in the audit log');

-- =============================================================== report fields
select tests.act_as('00000000-0000-4000-8000-000000000005');
select lives_ok($$ select public.update_assessment_report(tests.aid(), '2026-11-06', 'Updated limitations') $$, 'the assessor can update the report fields');
select is((select limitations_text from public.assessments where id = tests.aid()), 'Updated limitations', 'and they are stored');
select tests.act_as('00000000-0000-4000-8000-000000000003');
select throws_ok($$ select public.update_assessment_report(tests.aid(), '2026-11-07', 'contractor edit') $$, '42501', null, 'a contractor cannot update the report');
select tests.act_as('00000000-0000-4000-8000-000000000006');
select throws_ok($$ select public.update_assessment_report(tests.aid(), '2026-11-07', 'outsider edit') $$, '42501', null, 'an outsider cannot either');

select tests.act_admin();
select * from finish();
rollback;
