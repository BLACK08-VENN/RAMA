-- Apply only to a dedicated Furniture Rama Supabase project.
-- Never apply this migration to the FAZOO database.
create table if not exists public.rama_3d_models (
  id uuid primary key default gen_random_uuid(),
  product_name text not null,
  product_sku text,
  source_image_url text,
  model_url text,
  storage_path text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  notes text,
  tripo_task_id text,
  credits_used integer not null default 0,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index if not exists rama_3d_models_status_idx on public.rama_3d_models(status);
alter table public.rama_3d_models enable row level security;
-- No direct client policies: all access goes through the authenticated, admin-only server API.
-- Service-role key must be configured server-side and never exposed publicly.
