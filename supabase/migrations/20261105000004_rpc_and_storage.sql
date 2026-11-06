-- Callable functions (RPC) and storage policies.

-- ---------------------------------------------------------------- create_organization
-- Self-serve sign-up: a signed-in user creates an org and becomes its first admin.
create function public.create_organization(
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

  insert into public.organizations (name, kind, ba_id, created_by)
  values (btrim(p_name), p_kind, nullif(btrim(p_ba_id), ''), auth.uid())
  returning id into v_org;

  insert into public.org_members (org_id, user_id, org_role)
  values (v_org, auth.uid(), 'admin');

  return v_org;
end;
$$;

-- ---------------------------------------------------------------- transition_workstream
-- The only way to change a workstream's status. Role rules:
--   start   : editor (licensee staff / assigned contractor), not_started -> in_progress
--   submit  : editor, in_progress | changes_requested -> submitted
--   return  : licensee admin or lead assessor, submitted | approved -> changes_requested (reason required)
--   approve : licensee admin, submitted -> approved
-- NOTE: the Directive 001 validation rules (docs/PLAN.md 4.3) are evaluated by the server action
-- BEFORE it calls this function. They are not re-checked here (Phase 2 hardening item).
create function public.transition_workstream(
  p_workstream uuid,
  p_action     public.review_action,
  p_reason     text default null
) returns public.workstream_status
language plpgsql security definer set search_path = '' as $$
declare
  v_site   uuid;
  v_from   public.workstream_status;
  v_to     public.workstream_status;
  v_locked timestamptz;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select a.site_id, w.status, a.locked_at into v_site, v_from, v_locked
  from public.workstreams w join public.assessments a on a.id = w.assessment_id
  where w.id = p_workstream;

  if v_site is null or not app.can_read_workstream(p_workstream) then
    raise exception 'workstream not found' using errcode = '42501';
  end if;
  if v_locked is not null then
    raise exception 'assessment is locked' using errcode = '42501';
  end if;

  if p_action = 'start' then
    if v_from <> 'not_started' then
      raise exception 'cannot start from status %', v_from using errcode = '23514';
    end if;
    if not (app.is_licensee_member(v_site) or app.is_assigned(p_workstream)) then
      raise exception 'not permitted' using errcode = '42501';
    end if;
    v_to := 'in_progress';

  elsif p_action = 'submit' then
    if v_from not in ('in_progress', 'changes_requested') then
      raise exception 'cannot submit from status %', v_from using errcode = '23514';
    end if;
    if not (app.is_licensee_member(v_site) or app.is_assigned(p_workstream)) then
      raise exception 'not permitted' using errcode = '42501';
    end if;
    v_to := 'submitted';

  elsif p_action = 'return' then
    if v_from not in ('submitted', 'approved') then
      raise exception 'cannot return from status %', v_from using errcode = '23514';
    end if;
    if not (app.is_licensee_admin(v_site) or app.has_grant(v_site, 'lead_assessor')) then
      raise exception 'not permitted' using errcode = '42501';
    end if;
    if p_reason is null or length(btrim(p_reason)) = 0 then
      raise exception 'a reason is required when returning a workstream' using errcode = '23514';
    end if;
    v_to := 'changes_requested';

  elsif p_action = 'approve' then
    if v_from <> 'submitted' then
      raise exception 'cannot approve from status %', v_from using errcode = '23514';
    end if;
    if not app.is_licensee_admin(v_site) then
      raise exception 'not permitted' using errcode = '42501';
    end if;
    v_to := 'approved';

  else
    raise exception 'unknown action' using errcode = '22023';
  end if;

  update public.workstreams set status = v_to where id = p_workstream;

  insert into public.review_events (workstream_id, actor_id, action, from_status, to_status, reason)
  values (p_workstream, auth.uid(), p_action, v_from, v_to, nullif(btrim(p_reason), ''));

  return v_to;
end;
$$;

revoke execute on function public.create_organization(text, public.org_kind, text) from public, anon;
revoke execute on function public.transition_workstream(uuid, public.review_action, text) from public, anon;
grant execute on function public.create_organization(text, public.org_kind, text) to authenticated;
grant execute on function public.transition_workstream(uuid, public.review_action, text) to authenticated;

-- ---------------------------------------------------------------- storage
-- One private bucket. Object names are '<uploader_org_id>/<site_id>/<file>'.
-- Reads are allowed only when the user can already read the matching rate_sheets / documents /
-- package_exports row (RLS applies inside these sub-selects), so file access can never be
-- wider than row access. Uploads need org membership + site access.
-- Known limit: an authorised user can upload an object that has no row yet (size-capped by the
-- bucket); orphan cleanup is a later housekeeping job.
insert into storage.buckets (id, name, public, file_size_limit)
values ('site-files', 'site-files', false, 52428800)
on conflict (id) do nothing;

create policy site_files_select on storage.objects for select to authenticated
  using (
    bucket_id = 'site-files' and (
      exists (select 1 from public.rate_sheets r where r.storage_path = storage.objects.name)
      or exists (select 1 from public.documents d where d.storage_path = storage.objects.name)
      or exists (select 1 from public.package_exports p where p.storage_path = storage.objects.name)
    )
  );

create policy site_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'site-files' and app.can_upload_path(name));

create policy site_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'site-files' and app.can_manage_path(name));
