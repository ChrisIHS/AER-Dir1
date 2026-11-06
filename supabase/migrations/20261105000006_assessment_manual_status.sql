-- Facts the app cannot derive for the Req. 58 completeness tracker (docs/PLAN.md 4.5):
--   liabilityDeclaration: 'none' | 'generated' | 'signed'   (F035, signed by a senior officer; 58(g)(i))
--   costFormsGenerated:   boolean                            (58(g)(ii))
--   supportingInfoNoneRequiredReason: string | null          (58(i))
--   aerSystemUpdate:      { date, reference } | null         (58(k))
-- Edited by the licensee admin (assessments_update policy already requires that).
alter table public.assessments
  add column manual_status jsonb not null default '{}'::jsonb;

grant update (manual_status) on public.assessments to authenticated;
