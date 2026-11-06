-- Phase 3: organization rate library (reuse across sites) and the senior officer's e-signature.

-- ================================================================ rate library
-- A library entry belongs to an organization and is visible only to its members. "Using" an entry on a
-- site copies the file into that site (so each submission package stays self-contained and the rates it
-- cites can't change later) and records where it came from in rate_sheets.source_library_id.
create table public.rate_library (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations (id) on delete cascade,
  uploaded_by     uuid references auth.users (id) on delete set null,
  vendor          text,
  title           text not null check (length(btrim(title)) > 0),
  effective_date  date,
  storage_path    text not null unique,
  discount_type   public.discount_type not null default 'none',
  notes           text,
  created_at      timestamptz not null default now(),
  archived_at     timestamptz
);
create index rate_library_org_idx on public.rate_library (org_id);

alter table public.rate_sheets
  add column source_library_id uuid references public.rate_library (id) on delete set null;

alter table public.rate_library enable row level security;
revoke all on public.rate_library from anon;
revoke truncate, references, trigger on public.rate_library from authenticated;

create policy rate_library_select on public.rate_library for select to authenticated
  using (app.is_org_member(org_id));
create policy rate_library_insert on public.rate_library for insert to authenticated
  with check (app.is_org_member(org_id) and uploaded_by = auth.uid());
create policy rate_library_update on public.rate_library for update to authenticated
  using (app.is_org_member(org_id)) with check (app.is_org_member(org_id));
create policy rate_library_delete on public.rate_library for delete to authenticated
  using (app.is_org_member(org_id));

-- Library objects live at '<org_id>/library/<file>'; site objects at '<org_id>/<site_id>/<file>'.
create or replace function app.can_upload_path(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.is_org_member(app.try_uuid((string_to_array(p_name, '/'))[1]))
     and ((string_to_array(p_name, '/'))[2] = 'library'
          or app.has_site_access(app.try_uuid((string_to_array(p_name, '/'))[2])));
$$;

create or replace function app.can_manage_path(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select (app.is_org_member(app.try_uuid((string_to_array(p_name, '/'))[1]))
          and ((string_to_array(p_name, '/'))[2] = 'library'
               or app.has_site_access(app.try_uuid((string_to_array(p_name, '/'))[2]))))
      or app.is_licensee_admin(app.try_uuid((string_to_array(p_name, '/'))[2]));
$$;

drop policy site_files_select on storage.objects;
create policy site_files_select on storage.objects for select to authenticated
  using (
    bucket_id = 'site-files' and (
      exists (select 1 from public.rate_sheets r where r.storage_path = storage.objects.name)
      or exists (select 1 from public.documents d where d.storage_path = storage.objects.name)
      or exists (select 1 from public.package_exports p where p.storage_path = storage.objects.name)
      or exists (select 1 from public.rate_library l where l.storage_path = storage.objects.name)
    )
  );

-- ================================================================ e-signatures
-- The licensee's senior corporate officer or director signs the Liability Declaration (F035) here.
-- The signature is bound to the figures it certified (content_hash), so if the estimate changes later
-- the signature is recognised as stale and the form goes back to "awaiting signature".
create table public.esignatures (
  id                    uuid primary key default gen_random_uuid(),
  assessment_id         uuid not null references public.assessments (id) on delete cascade,
  kind                  text not null check (kind in ('officer_liability_declaration')),
  signer_id             uuid not null references auth.users (id) on delete restrict,
  signer_name           text not null,
  signer_position       text not null,
  typed_signature       text not null,
  statement_text        text not null,
  statement_text_version text not null,
  content_hash          text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  user_agent            text,
  signed_at             timestamptz not null default now()
);
create index esignatures_assessment_idx on public.esignatures (assessment_id, signed_at desc);

alter table public.esignatures enable row level security;
revoke all on public.esignatures from anon;
revoke insert, update, delete on public.esignatures from authenticated;  -- via esign_liability_declaration()
revoke truncate, references, trigger on public.esignatures from authenticated;

create policy esignatures_select on public.esignatures for select to authenticated
  using (app.is_licensee_member(app.assessment_site(assessment_id))
         or app.has_grant(app.assessment_site(assessment_id), 'lead_assessor'));

create function public.esign_liability_declaration(
  p_assessment    uuid,
  p_name          text,
  p_position      text,
  p_typed         text,
  p_statement     text,
  p_version       text,
  p_hash          text,
  p_user_agent    text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_site   uuid;
  v_locked timestamptz;
  v_id     uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  select a.site_id, a.locked_at into v_site, v_locked from public.assessments a where a.id = p_assessment;
  if v_site is null or not app.is_licensee_admin(v_site) then
    raise exception 'only a licensee admin can sign the Liability Declaration' using errcode = '42501';
  end if;
  if v_locked is null then
    raise exception 'the lead assessor must sign the assessment first, so the figures are final' using errcode = '23514';
  end if;
  if length(btrim(coalesce(p_name, ''))) = 0 or length(btrim(coalesce(p_position, ''))) = 0 then
    raise exception 'name and position are required' using errcode = '23514';
  end if;
  if lower(btrim(coalesce(p_typed, ''))) <> lower(btrim(p_name)) then
    raise exception 'type your full name exactly as entered above to sign' using errcode = '23514';
  end if;
  if p_hash is null or p_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid content hash' using errcode = '22023';
  end if;
  if p_statement is null or length(btrim(p_statement)) = 0 or p_version is null or length(btrim(p_version)) = 0 then
    raise exception 'statement text and version are required' using errcode = '22023';
  end if;

  insert into public.esignatures (assessment_id, kind, signer_id, signer_name, signer_position, typed_signature,
                                  statement_text, statement_text_version, content_hash, user_agent)
  values (p_assessment, 'officer_liability_declaration', auth.uid(), btrim(p_name), btrim(p_position), btrim(p_typed),
          btrim(p_statement), btrim(p_version), p_hash, left(p_user_agent, 300))
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.esign_liability_declaration(uuid, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.esign_liability_declaration(uuid, text, text, text, text, text, text, text) to authenticated;

-- ================================================================ audit
-- Same function as before, extended so library changes are attributed to their organization.
create or replace function app.audit_row() returns trigger
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
    when 'esignatures' then app.assessment_site((v_rec ->> 'assessment_id')::uuid)
    when 'package_exports' then app.assessment_site((v_rec ->> 'assessment_id')::uuid)
    when 'workstreams' then app.assessment_site((v_rec ->> 'assessment_id')::uuid)
    when 'organizations' then null
    when 'org_members' then null
    when 'rate_library' then null
    else app.workstream_site((v_rec ->> 'workstream_id')::uuid)
  end;

  v_org := case tg_table_name
    when 'organizations' then (v_rec ->> 'id')::uuid
    when 'org_members' then (v_rec ->> 'org_id')::uuid
    when 'rate_library' then (v_rec ->> 'org_id')::uuid
    else null
  end;

  insert into public.audit_log (actor, site_id, org_id, action, table_name, record_id, before, after)
  values (auth.uid(), v_site, v_org, tg_op, tg_table_name, v_id, v_old, v_new);
  return null;
end;
$$;

create trigger audit_rate_library after insert or update or delete on public.rate_library
  for each row execute function app.audit_row();
create trigger audit_esignatures after insert or update or delete on public.esignatures
  for each row execute function app.audit_row();
