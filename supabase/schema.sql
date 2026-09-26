-- Homes: one row per homeowner submission
create table if not exists public.homes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  customer_name text not null,
  customer_email text not null,
  in_austin boolean not null,
  has_solar boolean not null,
  panel_same_wall_answer text not null default 'not_asked'
    check (panel_same_wall_answer in ('yes','no','not_sure','not_asked')),
  setup_type text not null default 'unknown'
    check (setup_type in ('separate_meter_and_panel_outdoors','combo_meter_main_unit','panel_indoors','unknown')),
  status text not null default 'in_progress'
    check (status in ('in_progress','submitted')),
  verdict text check (verdict in ('PASS','FAIL','REVIEW')),
  battery_count int check (battery_count between 0 and 2),
  reasons jsonb not null default '[]'::jsonb,
  surveyor_decision text check (surveyor_decision in ('approved','rejected','needs_site_visit')),
  surveyor_note text,
  submitted_at timestamptz
);

-- Photos: one row per capture attempt
create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  home_id uuid not null references public.homes(id) on delete cascade,
  step text not null,
  attempt int not null,
  storage_path text not null,
  status text not null
    check (status in ('accepted','retake','check_failed','accepted_after_max_attempts')),
  analysis jsonb,
  error text,
  model text,
  latency_ms int,
  ai_attempts int not null default 1
);

create index if not exists photos_home_idx on public.photos(home_id, step, attempt);
create index if not exists homes_created_idx on public.homes(created_at desc);

-- Lock tables to server-side access only
alter table public.homes enable row level security;
alter table public.photos enable row level security;

-- New Supabase projects need explicit grants for API access
grant usage on schema public to service_role;
grant all on public.homes to service_role;
grant all on public.photos to service_role;

-- Private storage bucket for photos
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;
