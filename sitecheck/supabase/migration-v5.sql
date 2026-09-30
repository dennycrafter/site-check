create table if not exists public.corrections (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  home_id uuid not null references public.homes(id) on delete cascade,
  photo_id uuid not null references public.photos(id) on delete cascade,
  step text not null,
  field text not null,
  ai_value jsonb,
  corrected_value jsonb not null
);
create index if not exists corrections_photo_idx on public.corrections(photo_id, field, created_at desc);
alter table public.corrections enable row level security;
grant all on public.corrections to service_role;
