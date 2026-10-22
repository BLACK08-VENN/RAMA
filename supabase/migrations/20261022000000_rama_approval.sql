-- Furniture Rama 3D approvals: apply only to a dedicated Rama Supabase project.
-- Admin status is assigned using trusted auth.users.raw_app_meta_data.rama_admin = true.
-- Do not use user_metadata for authorization.
create table if not exists public.rama_model_reviews (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 140),
  category text not null check (category in ('chairs','sofas','tables','decor')),
  source_url text,
  description text not null default '',
  status text not null default 'awaiting_file' check (status in ('awaiting_file','pending_review','approved','rejected')),
  review_path text,
  public_path text,
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes between 12 and 52428800),
  width_m numeric(7,3) not null default 0.7 check (width_m between 0.05 and 12),
  depth_m numeric(7,3) not null default 0.7 check (depth_m between 0.05 and 12),
  height_m numeric(7,3) not null default 1 check (height_m between 0.05 and 12),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  constraint reviewed_published_has_asset check (status <> 'approved' or (review_path is not null and public_path is not null)),
  constraint public_path_only_approved check (public_path is null or status = 'approved')
);
create index if not exists rama_model_reviews_status_idx on public.rama_model_reviews (status, created_at desc);
alter table public.rama_model_reviews enable row level security;

grant select on public.rama_model_reviews to anon;
grant select, insert, update on public.rama_model_reviews to authenticated;

-- Read approved metadata publicly, including the public storage path.
create policy "rama_approved_public_read" on public.rama_model_reviews
  for select to anon, authenticated using (status = 'approved');
create policy "rama_admin_read_all" on public.rama_model_reviews
  for select to authenticated
  using ((select auth.jwt()->'app_metadata'->>'rama_admin') = 'true');
create policy "rama_admin_insert" on public.rama_model_reviews
  for insert to authenticated
  with check ((select auth.jwt()->'app_metadata'->>'rama_admin') = 'true');
create policy "rama_admin_update" on public.rama_model_reviews
  for update to authenticated
  using ((select auth.jwt()->'app_metadata'->>'rama_admin') = 'true')
  with check ((select auth.jwt()->'app_metadata'->>'rama_admin') = 'true');

-- Never expose models for review before approval.
insert into storage.buckets (id,name,public,file_size_limit)
  values ('rama-model-review','rama-model-review',false,52428800)
  on conflict (id) do nothing;
insert into storage.buckets (id,name,public,file_size_limit)
  values ('rama-models','rama-models',true,52428800)
  on conflict (id) do nothing;

create policy "rama_admin_storage_select" on storage.objects
  for select to authenticated
  using (bucket_id in ('rama-model-review','rama-models')
    and (select auth.jwt()->'app_metadata'->>'rama_admin') = 'true');
create policy "rama_admin_storage_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('rama-model-review','rama-models')
    and name like '%.glb'
    and (select auth.jwt()->'app_metadata'->>'rama_admin') = 'true');
create policy "rama_admin_storage_update" on storage.objects
  for update to authenticated
  using (bucket_id in ('rama-model-review','rama-models')
    and (select auth.jwt()->'app_metadata'->>'rama_admin') = 'true')
  with check (bucket_id in ('rama-model-review','rama-models')
    and (select auth.jwt()->'app_metadata'->>'rama_admin') = 'true');
create policy "rama_admin_storage_delete" on storage.objects
  for delete to authenticated
  using (bucket_id in ('rama-model-review','rama-models')
    and (select auth.jwt()->'app_metadata'->>'rama_admin') = 'true');

comment on table public.rama_model_reviews is
  'Rama-only approval queue, protected by trusted admin JWT metadata. Pending GLBs are private.';
