-- Rate library, storage paths, and the officer e-signature (Phase 3). Run with: npm run db:test
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


-- =============================================================== rate library
select tests.act_admin();
insert into public.rate_library (id, org_id, uploaded_by, title, storage_path)
  values ('e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003', 'A library rates',
          'a0000000-0000-4000-8000-000000000002/library/rates.pdf');
insert into storage.objects (bucket_id, name) values ('site-files', 'a0000000-0000-4000-8000-000000000002/library/rates.pdf');

select tests.act_as('00000000-0000-4000-8000-000000000003');
select is((select count(*) from public.rate_library), 1::bigint, 'A sees its own library entry');
select lives_ok($$ insert into public.rate_library (org_id, uploaded_by, title, storage_path)
    values ('a0000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003', 'A second', 'a0000000-0000-4000-8000-000000000002/library/second.pdf') $$,
  'A can add to its library');
select throws_ok($$ insert into public.rate_library (org_id, uploaded_by, title, storage_path)
    values ('a0000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000003', 'into B', 'a0000000-0000-4000-8000-000000000003/library/x.pdf') $$,
  '42501', null, 'A cannot add to B''s library');
select throws_ok($$ insert into public.rate_library (org_id, uploaded_by, title, storage_path)
    values ('a0000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000004', 'forged uploader', 'a0000000-0000-4000-8000-000000000002/library/y.pdf') $$,
  '42501', null, 'the uploader must be the signed-in user');
select lives_ok($$ update public.rate_library set notes = 'checked' where id = 'e0000000-0000-4000-8000-000000000001' $$, 'A can edit its entry');
select is((select count(*) from storage.objects where name = 'a0000000-0000-4000-8000-000000000002/library/rates.pdf'), 1::bigint, 'A can read its library file');
select lives_ok($$ insert into storage.objects (bucket_id, name) values ('site-files', 'a0000000-0000-4000-8000-000000000002/library/new.pdf') $$, 'A can upload to its library folder');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('site-files', 'a0000000-0000-4000-8000-000000000003/library/new.pdf') $$, '42501', null, 'A cannot upload into B''s library folder');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('site-files', 'a0000000-0000-4000-8000-000000000002/b0000000-0000-4000-8000-000000000002/leak.pdf') $$, '42501', null, 'site-folder upload rules still hold');
select lives_ok($$ insert into public.rate_sheets (site_id, uploaded_by_org, uploaded_by, title, storage_path, source_library_id)
    values ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003', 'From library',
            'a0000000-0000-4000-8000-000000000002/b0000000-0000-4000-8000-000000000001/copy.pdf', 'e0000000-0000-4000-8000-000000000001') $$,
  'A can use a library entry on a site it has access to');

select tests.act_as('00000000-0000-4000-8000-000000000004');
select is((select count(*) from public.rate_library), 0::bigint, 'B cannot see A''s library');
select is((select count(*) from storage.objects where name = 'a0000000-0000-4000-8000-000000000002/library/rates.pdf'), 0::bigint, 'B cannot read A''s library file');
select is_empty($$ update public.rate_library set notes = 'hijack' where id = 'e0000000-0000-4000-8000-000000000001' returning id $$, 'B cannot edit A''s entry');
select is_empty($$ delete from public.rate_library where id = 'e0000000-0000-4000-8000-000000000001' returning id $$, 'B cannot delete A''s entry');

select tests.act_as('00000000-0000-4000-8000-000000000001');
select is((select count(*) from public.rate_library), 0::bigint, 'the licensee cannot see a contractor''s library');
select tests.act_as('00000000-0000-4000-8000-000000000006');
select is((select count(*) from storage.objects where name like '%/library/%'), 0::bigint, 'an outsider sees no library files');
select tests.act_as('00000000-0000-4000-8000-000000000003');
select lives_ok($$ delete from public.rate_library where id = 'e0000000-0000-4000-8000-000000000001' $$, 'A can delete its own entry');
select is((select source_library_id is null from public.rate_sheets where title = 'From library'), true, 'a site copy survives deleting its library source');
select tests.act_admin();
select ok((select count(*) from public.audit_log where table_name = 'rate_library' and org_id = 'a0000000-0000-4000-8000-000000000002') >= 3, 'library changes are audited against the organization');

-- =============================================================== e-signature
select tests.act_as('00000000-0000-4000-8000-000000000001');
select throws_ok($$ select public.esign_liability_declaration(tests.aid(), 'Dana Admin', 'President', 'Dana Admin',
    'I certify...', '2025-02', repeat('a', 64)) $$,
  '23514', null, 'cannot e-sign before the lead assessor has signed');

select tests.act_admin();
select tests.ready();
insert into public.assessor_credentials (user_id, association, registration_no, good_standing_attested_at)
  values ('00000000-0000-4000-8000-000000000005', 'APEGA', 'DEMO-9999', now());
select tests.act_as('00000000-0000-4000-8000-000000000005');
select public.sign_statement(tests.aid(), 'care_susp_aband', '2025-02');
select public.sign_statement(tests.aid(), 'remediation_reclamation', '2025-02');

select tests.act_as('00000000-0000-4000-8000-000000000001');
select throws_ok($$ select public.esign_liability_declaration(tests.aid(), 'Dana Admin', 'President', 'Someone Else',
    'I certify...', '2025-02', repeat('a', 64)) $$,
  '23514', null, 'the typed signature must match the name');
select throws_ok($$ select public.esign_liability_declaration(tests.aid(), 'Dana Admin', '  ', 'Dana Admin',
    'I certify...', '2025-02', repeat('a', 64)) $$,
  '23514', null, 'a position is required');
select throws_ok($$ select public.esign_liability_declaration(tests.aid(), 'Dana Admin', 'President', 'Dana Admin',
    'I certify...', '2025-02', 'not-a-hash') $$,
  '22023', null, 'the content hash must be a SHA-256 hex string');
select lives_ok($$ select public.esign_liability_declaration(tests.aid(), ' Dana Admin ', 'President', 'dana admin',
    'I certify...', '2025-02', repeat('a', 64), 'test-agent') $$,
  'the licensee admin can e-sign once the assessor has signed (case-insensitive typed name)');
select is((select signer_name from public.esignatures), 'Dana Admin', 'the name is stored trimmed');
select is((select signer_id from public.esignatures), '00000000-0000-4000-8000-000000000001'::uuid, 'and the signer is the signed-in user');

select tests.act_as('00000000-0000-4000-8000-000000000002');
select throws_ok($$ select public.esign_liability_declaration(tests.aid(), 'Lee Member', 'Manager', 'Lee Member',
    'I certify...', '2025-02', repeat('b', 64)) $$,
  '42501', null, 'a non-admin licensee member cannot e-sign');
select is((select count(*) from public.esignatures), 1::bigint, 'but can read the signature');
select tests.act_as('00000000-0000-4000-8000-000000000003');
select throws_ok($$ select public.esign_liability_declaration(tests.aid(), 'Casey', 'Contractor', 'Casey',
    'I certify...', '2025-02', repeat('b', 64)) $$,
  '42501', null, 'a contractor cannot e-sign');
select is((select count(*) from public.esignatures), 0::bigint, 'and cannot read signatures');
select tests.act_as('00000000-0000-4000-8000-000000000005');
select is((select count(*) from public.esignatures), 1::bigint, 'the lead assessor can read the signature');
select throws_ok($$ insert into public.esignatures (assessment_id, kind, signer_id, signer_name, signer_position, typed_signature,
    statement_text, statement_text_version, content_hash) values (tests.aid(), 'officer_liability_declaration',
    '00000000-0000-4000-8000-000000000005', 'x', 'y', 'z', 's', 'v', repeat('c', 64)) $$,
  '42501', null, 'signatures cannot be inserted directly');
select throws_ok($$ update public.esignatures set signer_name = 'tampered' $$, '42501', null, 'signatures cannot be edited');
select throws_ok($$ delete from public.esignatures $$, '42501', null, 'or deleted');

select tests.act_as('00000000-0000-4000-8000-000000000001');
select lives_ok($$ select public.reopen_assessment(tests.aid()) $$, 'reopening works');
select is((select count(*) from public.esignatures), 1::bigint, 'and the e-signature record remains (it goes stale by hash, not by deletion)');

select tests.act_admin();
select ok((select count(*) from public.audit_log where table_name = 'esignatures' and action = 'INSERT') = 1, 'the e-signature is audited');
select * from finish();
rollback;
