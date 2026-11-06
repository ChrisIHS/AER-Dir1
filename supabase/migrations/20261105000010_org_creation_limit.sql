-- Self-serve sign-up: stop one account creating organizations without limit.
-- (Per-IP sign-up limits and CAPTCHA are configured in Supabase Auth; see docs/DEPLOY.md.)
create or replace function public.create_organization(
  p_name  text,
  p_kind  public.org_kind,
  p_ba_id text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_name is null or length(btrim(p_name)) = 0 then
    raise exception 'organization name is required' using errcode = '23514';
  end if;
  if (select count(*) from public.organizations o where o.created_by = auth.uid()) >= 3 then
    raise exception 'you have reached the limit of 3 organizations created by one account; contact support to add more'
      using errcode = '23514';
  end if;

  insert into public.organizations (name, kind, ba_id, created_by)
  values (btrim(p_name), p_kind, nullif(btrim(p_ba_id), ''), auth.uid())
  returning id into v_org;

  insert into public.org_members (org_id, user_id, org_role)
  values (v_org, auth.uid(), 'admin');

  return v_org;
end;
$$;
