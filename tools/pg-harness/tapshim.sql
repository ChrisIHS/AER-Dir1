-- Tiny stand-in for the pgTAP functions the project's tests use. Each assertion returns one TAP line.
create function no_plan() returns text language sql as $$ select 'plan: no_plan'::text $$;
create function finish() returns text language sql as $$ select 'finish'::text $$;
create function ok(boolean, text default '') returns text language sql as $$
  select case when $1 then 'ok - ' || $2 else 'not ok - ' || $2 end $$;
create function is(anyelement, anyelement, text default '') returns text language sql as $$
  select case when $1 is not distinct from $2 then 'ok - ' || $3
    else 'not ok - ' || $3 || E'\n#   have: ' || coalesce($1::text, 'NULL') || E'\n#   want: ' || coalesce($2::text, 'NULL') end $$;
create function is_empty(text, text default '') returns text language plpgsql as $$
declare r record; n int := 0;
begin
  for r in execute $1 loop n := n + 1; end loop;
  if n = 0 then return 'ok - ' || $2; end if;
  return 'not ok - ' || $2 || E'\n#   returned ' || n || ' row(s)';
end $$;
create function lives_ok(text, text default '') returns text language plpgsql as $$
begin
  execute $1;
  return 'ok - ' || $2;
exception when others then
  return 'not ok - ' || $2 || E'\n#   threw ' || sqlstate || ': ' || sqlerrm;
end $$;
create function throws_ok(text, text, text, text default '') returns text language plpgsql as $$
begin
  execute $1;
  return 'not ok - ' || $4 || E'\n#   no exception (wanted ' || $2 || ')';
exception when others then
  if sqlstate = $2 and ($3 is null or sqlerrm = $3) then return 'ok - ' || $4; end if;
  return 'not ok - ' || $4 || E'\n#   wanted ' || $2 || ', got ' || sqlstate || ': ' || sqlerrm;
end $$;
