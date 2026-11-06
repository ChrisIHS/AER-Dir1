-- Self-serve organization creation limit. Run with: npm run db:test
begin;
select no_plan();

create schema tests;
grant usage on schema tests to anon, authenticated;
create function tests.act_as(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;
create function tests.act_admin() returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'busy@example.test', '{}'),
  ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other@example.test', '{}');

select tests.act_as('00000000-0000-4000-8000-0000000000a1');
select lives_ok($$ select public.create_organization('Org 1', 'licensee') $$, 'first organization');
select lives_ok($$ select public.create_organization('Org 2', 'contractor') $$, 'second organization');
select lives_ok($$ select public.create_organization('Org 3', 'assessor_firm') $$, 'third organization');
select throws_ok($$ select public.create_organization('Org 4', 'licensee') $$, '23514', null, 'a fourth is refused');
select is((select count(*) from public.organizations where created_by = '00000000-0000-4000-8000-0000000000a1'), 3::bigint, 'only three exist');

select tests.act_as('00000000-0000-4000-8000-0000000000a2');
select lives_ok($$ select public.create_organization('Someone else''s org', 'licensee') $$, 'the limit is per account, not global');
select throws_ok($$ select public.create_organization('   ', 'licensee') $$, '23514', null, 'blank names are still rejected');

select tests.act_admin();
select * from finish();
rollback;
