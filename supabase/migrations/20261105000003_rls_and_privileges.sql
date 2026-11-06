-- Row-level security and table privileges. Organization isolation lives HERE, not in app code.
-- Every new table must: enable RLS, define policies for `authenticated` only, and ship a
-- pgTAP test in supabase/tests/database/.

-- ---------------------------------------------------------------- privileges
-- Supabase's default privileges hand every table to anon/authenticated; RLS is then the only
-- guard. Tighten the privilege layer as well, so a missing policy is not the sole defence.
revoke all on all tables in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke truncate, references, trigger on tables from authenticated;

-- Column-level UPDATE: privileged columns can't be written directly.
revoke update on public.organizations from authenticated;
grant  update (name, ba_id) on public.organizations to authenticated;
revoke insert, delete on public.organizations from authenticated;          -- via create_organization()

revoke update on public.assessments from authenticated;
grant  update (assessment_date, limitations_text) on public.assessments to authenticated;
revoke insert, delete on public.assessments from authenticated;            -- created by trigger

revoke update on public.workstreams from authenticated;
grant  update (applicable, na_rationale) on public.workstreams to authenticated;
revoke insert, delete on public.workstreams from authenticated;            -- created by trigger

-- Append-only / system-written tables
revoke insert, update, delete on public.audit_log from authenticated;
revoke insert, update, delete on public.review_events from authenticated;  -- via transition_workstream()
revoke update, delete on public.signoffs from authenticated;

-- ---------------------------------------------------------------- enable RLS
alter table public.organizations          enable row level security;
alter table public.profiles               enable row level security;
alter table public.org_members            enable row level security;
alter table public.assessor_credentials   enable row level security;
alter table public.sites                  enable row level security;
alter table public.site_grants            enable row level security;
alter table public.assessments            enable row level security;
alter table public.personnel              enable row level security;
alter table public.workstreams            enable row level security;
alter table public.workstream_assignments enable row level security;
alter table public.workstream_details     enable row level security;
alter table public.rate_sheets            enable row level security;
alter table public.documents              enable row level security;
alter table public.cost_line_items        enable row level security;
alter table public.comments               enable row level security;
alter table public.review_events          enable row level security;
alter table public.signoffs               enable row level security;
alter table public.package_exports        enable row level security;
alter table public.audit_log              enable row level security;

-- ---------------------------------------------------------------- organizations / profiles
create policy organizations_select on public.organizations for select to authenticated
  using (app.can_see_org(id));
create policy organizations_update on public.organizations for update to authenticated
  using (app.is_org_admin(id)) with check (app.is_org_admin(id));

create policy profiles_select on public.profiles for select to authenticated
  using (app.can_see_user(user_id));
create policy profiles_update on public.profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy org_members_select on public.org_members for select to authenticated
  using (app.is_org_member(org_id));
create policy org_members_insert on public.org_members for insert to authenticated
  with check (app.is_org_admin(org_id));
create policy org_members_update on public.org_members for update to authenticated
  using (app.is_org_admin(org_id)) with check (app.is_org_admin(org_id));
create policy org_members_delete on public.org_members for delete to authenticated
  using (app.is_org_admin(org_id) or user_id = auth.uid());

create policy assessor_credentials_select on public.assessor_credentials for select to authenticated
  using (app.can_see_user(user_id));
create policy assessor_credentials_write on public.assessor_credentials for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------- sites / grants
-- NB: sites policies use inline column checks (see header of migration 2).
create policy sites_select on public.sites for select to authenticated
  using (app.is_org_member(licensee_org_id) or app.has_any_grant(id));
create policy sites_insert on public.sites for insert to authenticated
  with check (app.is_org_admin(licensee_org_id)
              and exists (select 1 from public.organizations o
                          where o.id = licensee_org_id and o.kind = 'licensee'));
create policy sites_update on public.sites for update to authenticated
  using (app.is_org_admin(licensee_org_id)) with check (app.is_org_admin(licensee_org_id));
create policy sites_delete on public.sites for delete to authenticated
  using (app.is_org_admin(licensee_org_id));

create policy site_grants_select on public.site_grants for select to authenticated
  using (app.is_licensee_member(site_id) or app.is_org_member(grantee_org_id));
create policy site_grants_insert on public.site_grants for insert to authenticated
  with check (app.is_licensee_admin(site_id));
create policy site_grants_update on public.site_grants for update to authenticated
  using (app.is_licensee_admin(site_id)) with check (app.is_licensee_admin(site_id));
create policy site_grants_delete on public.site_grants for delete to authenticated
  using (app.is_licensee_admin(site_id));

-- ---------------------------------------------------------------- assessments / personnel
create policy assessments_select on public.assessments for select to authenticated
  using (app.is_licensee_member(site_id) or app.has_grant(site_id, 'lead_assessor'));
create policy assessments_update on public.assessments for update to authenticated
  using (app.is_licensee_admin(site_id) and locked_at is null)
  with check (app.is_licensee_admin(site_id));

create policy personnel_select on public.personnel for select to authenticated
  using (app.is_licensee_member(app.assessment_site(assessment_id))
         or app.has_grant(app.assessment_site(assessment_id), 'lead_assessor'));
create policy personnel_write on public.personnel for all to authenticated
  using (app.is_licensee_admin(app.assessment_site(assessment_id))
         or app.has_grant(app.assessment_site(assessment_id), 'lead_assessor'))
  with check (app.is_licensee_admin(app.assessment_site(assessment_id))
              or app.has_grant(app.assessment_site(assessment_id), 'lead_assessor'));

-- ---------------------------------------------------------------- workstreams
create policy workstreams_select on public.workstreams for select to authenticated
  using (app.can_read_workstream(id));
create policy workstreams_update on public.workstreams for update to authenticated
  using (app.can_edit_workstream(id)) with check (app.can_read_workstream(id));

create policy workstream_assignments_select on public.workstream_assignments for select to authenticated
  using (app.is_licensee_member(app.workstream_site(workstream_id))
         or app.has_grant(app.workstream_site(workstream_id), 'lead_assessor')
         or app.is_org_member(org_id));
create policy workstream_assignments_insert on public.workstream_assignments for insert to authenticated
  with check (app.is_licensee_admin(app.workstream_site(workstream_id)));
create policy workstream_assignments_update on public.workstream_assignments for update to authenticated
  using (app.is_licensee_admin(app.workstream_site(workstream_id)))
  with check (app.is_licensee_admin(app.workstream_site(workstream_id)));
create policy workstream_assignments_delete on public.workstream_assignments for delete to authenticated
  using (app.is_licensee_admin(app.workstream_site(workstream_id)));

create policy workstream_details_select on public.workstream_details for select to authenticated
  using (app.can_read_workstream(workstream_id));
create policy workstream_details_update on public.workstream_details for update to authenticated
  using (app.can_edit_workstream(workstream_id)) with check (app.can_edit_workstream(workstream_id));

-- ---------------------------------------------------------------- line items
create policy cost_line_items_select on public.cost_line_items for select to authenticated
  using (app.can_read_workstream(workstream_id));
create policy cost_line_items_insert on public.cost_line_items for insert to authenticated
  with check (app.can_edit_workstream(workstream_id));
create policy cost_line_items_update on public.cost_line_items for update to authenticated
  using (app.can_edit_workstream(workstream_id)) with check (app.can_edit_workstream(workstream_id));
create policy cost_line_items_delete on public.cost_line_items for delete to authenticated
  using (app.can_edit_workstream(workstream_id));

-- ---------------------------------------------------------------- rate sheets / documents
create policy rate_sheets_select on public.rate_sheets for select to authenticated
  using (
    (app.is_org_member(uploaded_by_org) and app.has_site_access(site_id))
    or app.is_licensee_member(site_id)
    or app.has_grant(site_id, 'lead_assessor')
    or (shared and app.has_grant(site_id, 'contractor'))
    or exists (select 1 from public.cost_line_items c
               where c.rate_sheet_id = rate_sheets.id and app.can_read_workstream(c.workstream_id))
  );
create policy rate_sheets_insert on public.rate_sheets for insert to authenticated
  with check (app.is_org_member(uploaded_by_org) and app.has_site_access(site_id)
              and uploaded_by = auth.uid());
create policy rate_sheets_update on public.rate_sheets for update to authenticated
  using ((app.is_org_member(uploaded_by_org) and app.has_site_access(site_id))
         or app.is_licensee_admin(site_id))
  with check ((app.is_org_member(uploaded_by_org) and app.has_site_access(site_id))
              or app.is_licensee_admin(site_id));
create policy rate_sheets_delete on public.rate_sheets for delete to authenticated
  using ((app.is_org_member(uploaded_by_org) and app.has_site_access(site_id))
         or app.is_licensee_admin(site_id));

create policy documents_select on public.documents for select to authenticated
  using (
    (app.is_org_member(uploaded_by_org) and app.has_site_access(site_id))
    or app.is_licensee_member(site_id)
    or app.has_grant(site_id, 'lead_assessor')
    or (workstream_id is not null and app.can_read_workstream(workstream_id))
  );
create policy documents_insert on public.documents for insert to authenticated
  with check (
    app.is_org_member(uploaded_by_org) and app.has_site_access(site_id) and uploaded_by = auth.uid()
    and (
      (workstream_id is not null and app.can_edit_workstream(workstream_id)
         and app.workstream_site(workstream_id) = site_id)
      or (workstream_id is null and (app.is_licensee_member(site_id)
                                     or app.has_grant(site_id, 'lead_assessor')))
    )
  );
create policy documents_update on public.documents for update to authenticated
  using ((app.is_org_member(uploaded_by_org) and app.has_site_access(site_id))
         or app.is_licensee_admin(site_id))
  with check ((app.is_org_member(uploaded_by_org) and app.has_site_access(site_id))
              or app.is_licensee_admin(site_id));
create policy documents_delete on public.documents for delete to authenticated
  using ((app.is_org_member(uploaded_by_org) and app.has_site_access(site_id))
         or app.is_licensee_admin(site_id));

-- ---------------------------------------------------------------- review / sign-off / audit / export
create policy comments_select on public.comments for select to authenticated
  using (app.can_read_workstream(workstream_id));
create policy comments_insert on public.comments for insert to authenticated
  with check (author_id = auth.uid() and app.can_read_workstream(workstream_id));
create policy comments_update on public.comments for update to authenticated
  using (author_id = auth.uid()
         or app.is_licensee_member(app.workstream_site(workstream_id))
         or app.has_grant(app.workstream_site(workstream_id), 'lead_assessor'))
  with check (app.can_read_workstream(workstream_id));

create policy review_events_select on public.review_events for select to authenticated
  using (app.can_read_workstream(workstream_id));

create policy signoffs_select on public.signoffs for select to authenticated
  using (app.is_licensee_member(app.assessment_site(assessment_id))
         or app.has_grant(app.assessment_site(assessment_id), 'lead_assessor'));
create policy signoffs_insert on public.signoffs for insert to authenticated
  with check (assessor_user_id = auth.uid()
              and app.has_grant(app.assessment_site(assessment_id), 'lead_assessor'));

create policy package_exports_select on public.package_exports for select to authenticated
  using (app.is_licensee_member(app.assessment_site(assessment_id))
         or app.has_grant(app.assessment_site(assessment_id), 'lead_assessor'));
create policy package_exports_insert on public.package_exports for insert to authenticated
  with check (app.is_licensee_admin(app.assessment_site(assessment_id)));

create policy audit_log_select on public.audit_log for select to authenticated
  using (
    (site_id is not null and (app.is_licensee_admin(site_id) or app.has_grant(site_id, 'lead_assessor')))
    or (org_id is not null and app.is_org_admin(org_id))
  );
