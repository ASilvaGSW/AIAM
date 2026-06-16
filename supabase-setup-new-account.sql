-- ============================================================
-- AIAM — Setup completo para una cuenta/proyecto NUEVO de Supabase
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query → Run
-- ============================================================
-- Este script deja el proyecto nuevo listo:
--   1. Crea la tabla public.products
--   2. Crea el bucket de Storage "Img" (público)
--   3. Aplica las políticas RLS (lectura pública / escritura autenticada)
--
-- DESPUÉS de correr esto:
--   - Crea un usuario admin: Authentication → Users → Add user
--   - Copia los datos viejos (ver guía de migración)
--   - Actualiza las credenciales en el código (URL + anon key + service role)
-- ============================================================

-- ----- 1. Tabla products -----
create table if not exists public.products (
  id            bigint generated always as identity primary key,
  created_at    timestamptz not null default now(),
  product_name  text not null,
  qty           integer not null default 0,
  price         numeric(10, 2) not null default 0,
  image         text,
  stripe_price_id text
);

-- ----- 2. Bucket de Storage "Img" (público) -----
insert into storage.buckets (id, name, public)
values ('Img', 'Img', true)
on conflict (id) do update set public = true;

-- ============================================================
-- 3. Políticas de seguridad (RLS)
-- ============================================================

-- ----- Tabla products -----
alter table public.products enable row level security;

drop policy if exists "Public read products" on public.products;
drop policy if exists "Anon read products" on public.products;
drop policy if exists "Authenticated insert products" on public.products;
drop policy if exists "Authenticated update products" on public.products;
drop policy if exists "Authenticated delete products" on public.products;

-- Catálogo (products.html) — solo lectura
create policy "Public read products"
on public.products
for select
to public
using (true);

-- CRUD (crud_products.html) — escritura solo con sesión iniciada
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
