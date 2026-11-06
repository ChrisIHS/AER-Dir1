-- Access helpers (used by RLS policies), integrity triggers, and the audit trigger.
--
-- Conventions:
--  * Helpers are SECURITY DEFINER with an empty search_path, so they read tables without
--    being filtered by RLS and cannot be hijacked through search_path.
--  * A helper must never query the table whose policy calls it for the *same* row being
--    inserted: STABLE functions do not see rows written by the calling statement, which
--    makes INSERT ... RETURNING fail. Policies on such tables use inline column checks.

grant usage on schema app to authenticated;

-- ---------------------------------------------------------------- membership helpers
create function app.is_org_member(p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.org_members m
                 where m.org_id = p_org and m.user_id = auth.uid());
$$;

create function app.is_org_admin(p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.org_members m
                 where m.org_id = p_org and m.user_id = auth.uid() and m.org_role = 'admin');
$$;

-- ---------------------------------------------------------------- site-level helpers
create function app.is_licensee_member(p_site uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.sites s
                 join public.org_members m on m.org_id = s.licensee_org_id
                 where s.id = p_site and m.user_id = auth.uid());
$$;

create function app.is_licensee_admin(p_site uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.sites s
                 join public.org_members m on m.org_id = s.licensee_org_id
                 where s.id = p_site and m.user_id = auth.uid() and m.org_role = 'admin');
$$;

create function app.has_grant(p_site uuid, p_role public.grant_role) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.site_grants g
                 join public.org_members m on m.org_id = g.grantee_org_id
                 where g.site_id = p_site and g.role = p_role and m.user_id = auth.uid());
$$;

create function app.has_any_grant(p_site uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.site_grants g
                 join public.org_members m on m.org_id = g.grantee_org_id
                 where g.site_id = p_site and m.user_id = auth.uid());
$$;

create function app.has_site_access(p_site uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.is_licensee_member(p_site) or app.has_any_grant(p_site);
$$;

-- ---------------------------------------------------------------- lookups
create function app.assessment_site(p_assessment uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select a.site_id from public.assessments a where a.id = p_assessment;
$$;

create function app.workstream_site(p_ws uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select a.site_id from public.workstreams w
  join public.assessments a on a.id = w.assessment_id where w.id = p_ws;
$$;

create function app.try_uuid(p text) returns uuid
language plpgsql immutable set search_path = '' as $$
begin
  return p::uuid;
exception when others then
  return null;
end;
$$;

-- ---------------------------------------------------------------- workstream-level helpers
-- A contractor is "assigned" only while their org still holds a contractor grant on the site.
create function app.is_assigned(p_ws uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.workstream_assignments wa
    join public.org_members m on m.org_id = wa.org_id
    join public.workstreams w on w.id = wa.workstream_id
    join public.assessments a on a.id = w.assessment_id
    join public.site_grants g
      on g.site_id = a.site_id and g.grantee_org_id = wa.org_id and g.role = 'contractor'
    where wa.workstream_id = p_ws
      and m.user_id = auth.uid()
      and (wa.user_id is null or wa.user_id = auth.uid())
  );
$$;

create function app.can_read_workstream(p_ws uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.is_licensee_member(app.workstream_site(p_ws))
      or app.has_grant(app.workstream_site(p_ws), 'lead_assessor')
      or app.is_assigned(p_ws);
$$;

-- Editing is allowed for licensee staff and assigned contractors, only while the workstream
-- is open (not submitted / approved) and the assessment is not locked.
create function app.can_edit_workstream(p_ws uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workstreams w
    join public.assessments a on a.id = w.assessment_id
    where w.id = p_ws
      and w.status in ('not_started', 'in_progress', 'changes_requested')
      and a.locked_at is null
  ) and (app.is_licensee_member(app.workstream_site(p_ws)) or app.is_assigned(p_ws));
$$;

-- ---------------------------------------------------------------- organisation visibility
-- Org names are visible to: members; the licensee of a site you can access; and, for
-- licensee staff and the site's lead assessor, the orgs granted on that site.
-- Contractors never see other contractor orgs.
create function app.can_see_org(p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.is_org_member(p_org)
      or exists (select 1 from public.sites s
                 where s.licensee_org_id = p_org and app.has_site_access(s.id))
      or exists (select 1 from public.site_grants g
                 where g.grantee_org_id = p_org
                   and (app.is_licensee_member(g.site_id)
                        or app.has_grant(g.site_id, 'lead_assessor')));
$$;

-- A user is visible if they belong to any org the caller can see.
-- (A definer function: a plain sub-select on org_members would be filtered by its own RLS.)
create function app.can_see_user(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_user = auth.uid()
      or exists (select 1 from public.org_members m
                 where m.user_id = p_user and app.can_see_org(m.org_id));
$$;

-- ---------------------------------------------------------------- upload path helper
-- Storage object names are '<uploader_org_id>/<site_id>/<file>'.
create function app.can_upload_path(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.is_org_member(app.try_uuid((string_to_array(p_name, '/'))[1]))
     and app.has_site_access(app.try_uuid((string_to_array(p_name, '/'))[2]));
$$;

create function app.can_manage_path(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select (app.is_org_member(app.try_uuid((string_to_array(p_name, '/'))[1]))
          and app.has_site_access(app.try_uuid((string_to_array(p_name, '/'))[2])))
      or app.is_licensee_admin(app.try_uuid((string_to_array(p_name, '/'))[2]));
$$;

revoke execute on all functions in schema app from public, anon;
grant execute on all functions in schema app to authenticated;

-- ================================================================ triggers
-- New auth user -> profile row
create function app.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_user();

-- New site -> assessment v1
create function app.create_first_assessment() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.assessments (site_id, version_no) values (new.id, 1);
  return new;
end;
$$;

create trigger sites_create_assessment
  after insert on public.sites
  for each row execute function app.create_first_assessment();

-- New assessment -> the seven workstreams (plus an empty details row each)
create function app.create_workstreams() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  k public.workstream_kind;
  ws_id uuid;
begin
  foreach k in array enum_range(null::public.workstream_kind) loop
    insert into public.workstreams (assessment_id, kind) values (new.id, k) returning id into ws_id;
    insert into public.workstream_details (workstream_id) values (ws_id);
  end loop;
  return new;
end;
$$;

create trigger assessments_create_workstreams
  after insert on public.assessments
  for each row execute function app.create_workstreams();

-- Workstream status is changed only by public.transition_workstream(). End users also lack
-- the UPDATE privilege on the column; this trigger is a second lock.
create function app.guard_workstream_status() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status is distinct from old.status and current_user in ('authenticated', 'anon') then
    raise exception 'workstream status can only change through transition_workstream()'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger workstreams_guard_status
  before update on public.workstreams
  for each row execute function app.guard_workstream_status();

-- Assignments may only target orgs that hold a contractor grant on the site
create function app.check_assignment() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.site_grants g
    where g.site_id = app.workstream_site(new.workstream_id)
      and g.grantee_org_id = new.org_id and g.role = 'contractor'
  ) then
    raise exception 'organization has no contractor grant on this site' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger workstream_assignments_check
  before insert or update on public.workstream_assignments
  for each row execute function app.check_assignment();

-- A licensee org cannot be granted access to its own site as an outside party
create function app.check_grant() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.sites s
             where s.id = new.site_id and s.licensee_org_id = new.grantee_org_id) then
    raise exception 'licensee organization already has full access to its own site'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger site_grants_check
  before insert or update on public.site_grants
  for each row execute function app.check_grant();

-- Line items may only point at rate sheets / documents of the same site
create function app.check_line_item() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_site uuid := app.workstream_site(new.workstream_id);
begin
  if new.rate_sheet_id is not null and not exists
     (select 1 from public.rate_sheets r where r.id = new.rate_sheet_id and r.site_id = v_site) then
    raise exception 'rate sheet belongs to a different site' using errcode = '23514';
  end if;
  if new.supporting_document_id is not null and not exists
     (select 1 from public.documents d where d.id = new.supporting_document_id and d.site_id = v_site) then
    raise exception 'document belongs to a different site' using errcode = '23514';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger cost_line_items_check
  before insert or update on public.cost_line_items
  for each row execute function app.check_line_item();

create function app.touch_details() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

create trigger workstream_details_touch
  before update on public.workstream_details
  for each row execute function app.touch_details();

-- ================================================================ audit
create function app.audit_row() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_old  jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new  jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_rec  jsonb := coalesce(v_new, v_old);
  v_site uuid;
  v_org  uuid;
  v_id   text;
begin
  if tg_op = 'UPDATE' and v_old = v_new then
    return null;
  end if;

  v_id := case tg_table_name
    when 'org_members'  then (v_rec ->> 'org_id') || ':' || (v_rec ->> 'user_id')
    when 'workstream_details' then v_rec ->> 'workstream_id'
    else v_rec ->> 'id'
  end;

  v_site := case tg_table_name
    when 'sites' then (v_rec ->> 'id')::uuid
    when 'site_grants' then (v_rec ->> 'site_id')::uuid
    when 'assessments' then (v_rec ->> 'site_id')::uuid
    when 'rate_sheets' then (v_rec ->> 'site_id')::uuid
    when 'documents' then (v_rec ->> 'site_id')::uuid
    when 'personnel' then app.assessment_site((v_rec ->> 'assessment_id')::uuid)
    when 'signoffs' then app.assessment_site((v_rec ->> 'assessment_id')::uuid)
    when 'package_exports' then app.assessment_site((v_rec ->> 'assessment_id')::uuid)
    when 'workstreams' then app.assessment_site((v_rec ->> 'assessment_id')::uuid)
    when 'organizations' then null
    when 'org_members' then null
    else app.workstream_site((v_rec ->> 'workstream_id')::uuid)
  end;

  v_org := case tg_table_name
    when 'organizations' then (v_rec ->> 'id')::uuid
    when 'org_members' then (v_rec ->> 'org_id')::uuid
    else null
  end;

  insert into public.audit_log (actor, site_id, org_id, action, table_name, record_id, before, after)
  values (auth.uid(), v_site, v_org, tg_op, tg_table_name, v_id, v_old, v_new);
  return null;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'organizations', 'org_members', 'sites', 'site_grants', 'assessments', 'personnel',
    'workstreams', 'workstream_assignments', 'workstream_details', 'rate_sheets', 'documents',
    'cost_line_items', 'comments', 'review_events', 'signoffs', 'package_exports'
  ] loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I
         for each row execute function app.audit_row()', 'audit_' || t, t);
  end loop;
end;
$$;

-- The audit log is append-only, even for the table owner and service role.
create function app.audit_log_immutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'audit_log is append-only' using errcode = '42501';
end;
$$;

create trigger audit_log_no_update_delete
  before update or delete on public.audit_log
  for each row execute function app.audit_log_immutable();

create trigger audit_log_no_truncate
  before truncate on public.audit_log
  for each statement execute function app.audit_log_immutable();
