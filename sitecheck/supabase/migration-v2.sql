-- SiteCheck v2: order reference from the source system, whole-site check, extra steps.
-- Safe to run more than once.
alter table public.homes
  add column if not exists external_ref text,
  add column if not exists site_check_status text not null default 'not_run'
    check (site_check_status in ('not_run','done','failed')),
  add column if not exists site_check jsonb,
  add column if not exists extra_steps jsonb not null default '[]'::jsonb;

notify pgrst, 'reload schema';
