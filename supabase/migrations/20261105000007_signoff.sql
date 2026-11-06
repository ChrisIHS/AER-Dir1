-- Phase 2: lead assessor sign-off (Req. 52-57), report fields, and reopening.
--
-- Sign-off is an RPC, not a direct INSERT, so the credentials snapshot can't be forged and the
-- DB itself refuses to sign an assessment that is incomplete. The Directive 001 rules are still
-- evaluated by the server action before this is called (see CLAUDE.md).

drop policy if exists signoffs_insert on public.signoffs;
revoke insert on public.signoffs from authenticated;

-- ---------------------------------------------------------------- update_assessment_report
-- Assessment date and the Req. 48 limitations section. Licensee admin or lead assessor.
create function public.update_assessment_report(
  p_assessment  uuid,
  p_date        date,
  p_limitations text
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_site   uuid;
  v_locked timestamptz;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  select a.site_id, a.locked_at into v_site, v_locked from public.assessments a where a.id = p_assessment;
  if v_site is null or not (app.is_licensee_admin(v_site) or app.has_grant(v_site, 'lead_assessor')) then
    raise exception 'not permitted' using errcode = '42501';
  end if;
  if v_locked is not null then
    raise exception 'assessment is locked' using errcode = '42501';
  end if;
  update public.assessments set assessment_date = p_date, limitations_text = nullif(btrim(p_limitations), '')
  where id = p_assessment;
end;
$$;

-- ---------------------------------------------------------------- sign_statement
create function public.sign_statement(
  p_assessment       uuid,
  p_statement        public.signoff_statement,
  p_text_version     text
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_site    uuid;
  v_locked  timestamptz;
  v_date    date;
  v_limits  text;
  v_creds   jsonb;
  v_name    text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  select a.site_id, a.locked_at, a.assessment_date, a.limitations_text
    into v_site, v_locked, v_date, v_limits
  from public.assessments a where a.id = p_assessment;

  if v_site is null or not app.has_grant(v_site, 'lead_assessor') then
    raise exception 'only the site''s lead assessor can sign' using errcode = '42501';
  end if;
  if v_locked is not null then
    raise exception 'assessment is already signed and locked' using errcode = '42501';
  end if;
  if p_text_version is null or length(btrim(p_text_version)) = 0 then
    raise exception 'statement version is required' using errcode = '22023';
  end if;
  if exists (select 1 from public.workstreams w
             where w.assessment_id = p_assessment and w.applicable and w.status <> 'approved') then
    raise exception 'every applicable workstream must be approved before sign-off' using errcode = '23514';
  end if;
  if v_date is null then
    raise exception 'set the assessment date first' using errcode = '23514';
  end if;
  if v_limits is null or length(btrim(v_limits)) = 0 then
    raise exception 'document the limiting conditions (Req. 48) first' using errcode = '23514';
  end if;
  if not exists (select 1 from public.personnel p where p.assessment_id = p_assessment) then
    raise exception 'record the personnel involved (Req. 51) first' using errcode = '23514';
  end if;

  select jsonb_agg(jsonb_build_object(
           'association', c.association,
           'registration_no', c.registration_no,
           'good_standing_attested_at', c.good_standing_attested_at)),
         p.full_name
    into v_creds, v_name
  from public.assessor_credentials c
  join public.profiles p on p.user_id = c.user_id
  where c.user_id = auth.uid() and c.good_standing_attested_at is not null
  group by p.full_name;
  if v_creds is null then
    raise exception 'record your professional credentials and attest good standing first (Req. 53)' using errcode = '23514';
  end if;

  insert into public.signoffs (assessment_id, statement, assessor_user_id, credentials_snapshot, statement_text_version)
  values (p_assessment, p_statement, auth.uid(),
          jsonb_build_object('name', v_name, 'credentials', v_creds), btrim(p_text_version));

  if (select count(*) from public.signoffs s where s.assessment_id = p_assessment) >= 2 then
    update public.assessments set status = 'signed', locked_at = now() where id = p_assessment;
  end if;
end;
$$;

-- ---------------------------------------------------------------- reopen_assessment
-- Licensee admin only. Removes both sign-offs (they were made on content that may now change) and
-- unlocks. The audit log keeps the removed rows.
create function public.reopen_assessment(p_assessment uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_site uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  select a.site_id into v_site from public.assessments a where a.id = p_assessment;
  if v_site is null or not app.is_licensee_admin(v_site) then
    raise exception 'not permitted' using errcode = '42501';
  end if;
  delete from public.signoffs where assessment_id = p_assessment;
  update public.assessments set status = 'in_review', locked_at = null where id = p_assessment;
end;
$$;

revoke execute on function public.update_assessment_report(uuid, date, text) from public, anon;
revoke execute on function public.sign_statement(uuid, public.signoff_statement, text) from public, anon;
revoke execute on function public.reopen_assessment(uuid) from public, anon;
grant execute on function public.update_assessment_report(uuid, date, text) to authenticated;
grant execute on function public.sign_statement(uuid, public.signoff_statement, text) to authenticated;
grant execute on function public.reopen_assessment(uuid) to authenticated;
