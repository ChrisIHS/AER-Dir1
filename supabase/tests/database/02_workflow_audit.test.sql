-- Workflow, audit and arithmetic tests. Run with: npm run db:test
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


-- =============================================================== generated total (Req. 2c: itemized, exact)
select is((select total from public.cost_line_items where id = 'c0000000-0000-4000-8000-000000000001'),
  250.31::numeric, '2.5 x 100.123 = 250.3075 rounds to 250.31');
select is((select total from public.cost_line_items where id = 'c0000000-0000-4000-8000-000000000002'),
  1000.00::numeric, '4 x 250 = 1000.00');

-- =============================================================== new site bootstraps
select is((select count(*) from public.assessments where site_id = 'b0000000-0000-4000-8000-000000000001'),
  1::bigint, 'a new site gets exactly one assessment');
select is((select version_no from public.assessments where site_id = 'b0000000-0000-4000-8000-000000000001'),
  1, 'the first assessment is version 1');
select is((select count(*) from public.workstreams w join public.assessments a on a.id = w.assessment_id
           where a.site_id = 'b0000000-0000-4000-8000-000000000001'), 7::bigint, 'an assessment gets seven workstreams');
select is((select count(*) from public.workstream_details d
           where d.workstream_id = tests.ws('b0000000-0000-4000-8000-000000000001', 'esa_remediation')),
  1::bigint, 'each workstream has a details row');

-- =============================================================== assignments
select throws_ok($$ insert into public.workstream_assignments (workstream_id, org_id)
    values (tests.ws('b0000000-0000-4000-8000-000000000001', 'suspension'), 'a0000000-0000-4000-8000-000000000005') $$,
  '23514', null, 'cannot assign an org that has no contractor grant on the site');

-- =============================================================== create_organization (self-serve)
select tests.act_as('00000000-0000-4000-8000-000000000006');
select lives_ok($$ select public.create_organization('New Contractor Ltd', 'contractor') $$,
  'a signed-in user can create an organization');
select is((select count(*) from public.org_members m join public.organizations o on o.id = m.org_id
           where o.name = 'New Contractor Ltd' and m.user_id = '00000000-0000-4000-8000-000000000006' and m.org_role = 'admin'),
  1::bigint, 'the creator becomes its admin');
select throws_ok($$ select public.create_organization('   ', 'licensee') $$, '23514', null, 'blank org name rejected');
select throws_ok($$ update public.organizations set kind = 'licensee' where name = 'New Contractor Ltd' $$,
  '42501', null, 'org kind cannot be changed after creation');

-- =============================================================== status workflow
-- A (assigned contractor) submits abandonment
select tests.act_as('00000000-0000-4000-8000-000000000003');
select is(public.transition_workstream(tests.ws('b0000000-0000-4000-8000-000000000001', 'abandonment'), 'submit'),
  'submitted'::public.workstream_status, 'A can submit its in-progress workstream');
select is_empty($$ update public.cost_line_items set notes = 'late edit'
    where id = 'c0000000-0000-4000-8000-000000000001' returning id $$,
  'line items are locked once submitted');
select throws_ok($$ select public.transition_workstream(tests.ws('b0000000-0000-4000-8000-000000000001', 'abandonment'), 'approve') $$,
  '42501', null, 'a contractor cannot approve');
select throws_ok($$ select public.transition_workstream(tests.ws('b0000000-0000-4000-8000-000000000001', 'reclamation'), 'submit') $$,
  '42501', null, 'A cannot submit B''s workstream');

-- assessor returns it (reason required), then A resubmits
select tests.act_as('00000000-0000-4000-8000-000000000005');
select throws_ok($$ select public.transition_workstream(tests.ws('b0000000-0000-4000-8000-000000000001', 'abandonment'), 'return') $$,
  '23514', null, 'return requires a reason');
select is(public.transition_workstream(tests.ws('b0000000-0000-4000-8000-000000000001', 'abandonment'), 'return', 'Add disposal tickets'),
  'changes_requested'::public.workstream_status, 'assessor can return a submitted workstream');
select throws_ok($$ select public.transition_workstream(tests.ws('b0000000-0000-4000-8000-000000000001', 'abandonment'), 'approve') $$,
  '23514', null, 'cannot approve a workstream that is not submitted');

select tests.act_as('00000000-0000-4000-8000-000000000003');
select lives_ok($$ update public.cost_line_items set notes = 'fixed' where id = 'c0000000-0000-4000-8000-000000000001' $$,
  'A can edit again after changes are requested');
select is(public.transition_workstream(tests.ws('b0000000-0000-4000-8000-000000000001', 'abandonment'), 'submit'),
  'submitted'::public.workstream_status, 'A resubmits');

-- assessor cannot approve; licensee admin can
select tests.act_as('00000000-0000-4000-8000-000000000005');
select throws_ok($$ select public.transition_workstream(tests.ws('b0000000-0000-4000-8000-000000000001', 'abandonment'), 'approve') $$,
  '42501', null, 'the assessor cannot approve');
select tests.act_as('00000000-0000-4000-8000-000000000002');
select throws_ok($$ select public.transition_workstream(tests.ws('b0000000-0000-4000-8000-000000000001', 'abandonment'), 'approve') $$,
  '42501', null, 'a non-admin licensee member cannot approve');
select tests.act_as('00000000-0000-4000-8000-000000000001');
select is(public.transition_workstream(tests.ws('b0000000-0000-4000-8000-000000000001', 'abandonment'), 'approve'),
  'approved'::public.workstream_status, 'the licensee admin can approve');

select is((select count(*) from public.review_events
           where workstream_id = tests.ws('b0000000-0000-4000-8000-000000000001', 'abandonment')),
  4::bigint, 'submit, return, submit, approve are all recorded as review events');
select is((select reason from public.review_events
           where workstream_id = tests.ws('b0000000-0000-4000-8000-000000000001', 'abandonment') and action = 'return'),
  'Add disposal tickets', 'the return reason is stored');
select throws_ok($$ insert into public.review_events (workstream_id, action, from_status, to_status)
    values (tests.ws('b0000000-0000-4000-8000-000000000001', 'abandonment'), 'approve', 'submitted', 'approved') $$,
  '42501', null, 'review events cannot be forged');

-- =============================================================== audit log
select ok((select count(*) from public.audit_log
           where table_name = 'workstreams' and action = 'UPDATE'
             and (after ->> 'status') = 'approved') > 0, 'status change to approved is in the audit log');
select is((select actor from public.audit_log
           where table_name = 'workstreams' and (after ->> 'status') = 'approved' limit 1),
  '00000000-0000-4000-8000-000000000001'::uuid, 'the audit row records who did it');
select ok((select count(*) from public.audit_log
           where table_name = 'cost_line_items' and action = 'UPDATE'
             and (before ->> 'notes') is distinct from (after ->> 'notes')) > 0,
  'line item edits are audited with before and after');

-- append-only, even for the owner
select tests.act_admin();
select throws_ok($$ update public.audit_log set action = 'tampered' $$, '42501', null, 'audit_log rows cannot be updated');
select throws_ok($$ delete from public.audit_log $$, '42501', null, 'audit_log rows cannot be deleted');
select throws_ok($$ truncate public.audit_log $$, '42501', null, 'audit_log cannot be truncated');

select * from finish();
rollback;
