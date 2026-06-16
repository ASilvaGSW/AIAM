-- ============================================================
-- AIAM — Full setup for a NEW Supabase account/project
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
-- ============================================================
-- This script prepares the new project:
--   1. Creates the public.products table
--   2. Creates the Storage bucket "Img" (public)
--   3. Applies RLS policies (public read / authenticated write)
--
-- AFTER running this:
--   - Create an admin user: Authentication → Users → Add user
--   - Copy data from the old project (see migration guide)
--   - Update credentials in the codebase (URL + anon key + service role)
-- ============================================================

-- ----- 1. Products table -----
create table if not exists public.products (
  id            bigint generated always as identity primary key,
  created_at    timestamptz not null default now(),
  product_name  text not null,
  qty           integer not null default 0,
  price         numeric(10, 2) not null default 0,
  image         text,
  stripe_price_id text
);

-- ----- 2. Storage bucket "Img" (public) -----
insert into storage.buckets (id, name, public)
values ('Img', 'Img', true)
on conflict (id) do update set public = true;

-- ============================================================
-- 3. Security policies (RLS)
-- ============================================================

-- ----- Products table -----
alter table public.products enable row level security;

drop policy if exists "Public read products" on public.products;
drop policy if exists "Anon read products" on public.products;
drop policy if exists "Authenticated insert products" on public.products;
drop policy if exists "Authenticated update products" on public.products;
drop policy if exists "Authenticated delete products" on public.products;

-- Catalog (products.html) — read only
create policy "Public read products"
on public.products
for select
to public
using (true);

-- CRUD (crud_products.html) — write only when signed in
create policy "Authenticated insert products"
on public.products
for insert
to authenticated
with check (true);

create policy "Authenticated update products"
on public.products
for update
to authenticated
using (true)
with check (true);

create policy "Authenticated delete products"
on public.products
for delete
to authenticated
using (true);

-- ----- Storage bucket Img -----
update storage.buckets set public = true where id = 'Img';

drop policy if exists "Img insert anon" on storage.objects;
drop policy if exists "Img update anon" on storage.objects;

drop policy if exists "Img public read" on storage.objects;
create policy "Img public read"
on storage.objects for select to public
using (bucket_id = 'Img');

drop policy if exists "Img insert authenticated" on storage.objects;
create policy "Img insert authenticated"
on storage.objects for insert to authenticated
with check (bucket_id = 'Img');

drop policy if exists "Img update authenticated" on storage.objects;
create policy "Img update authenticated"
on storage.objects for update to authenticated
using (bucket_id = 'Img')
with check (bucket_id = 'Img');

drop policy if exists "Img delete authenticated" on storage.objects;
create policy "Img delete authenticated"
on storage.objects for delete to authenticated
using (bucket_id = 'Img');
