-- site-check v3: when the surveyor decision was saved, for the "decided today" count.
-- Safe to run more than once.
alter table public.homes add column if not exists decided_at timestamptz;

notify pgrst, 'reload schema';
