-- ============================================================
-- Security policies for AIAM products + storage
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================
--
-- BEFORE running:
-- 1. Create an admin user: Authentication → Users → Add user
-- 2. Use that email/password to sign in at crud_products.html
--
-- Result:
-- - products.html (public) can READ products (anon)
-- - crud_products.html can only WRITE when signed in (authenticated)
-- ============================================================

-- ----- Products table -----
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read products" ON public.products;
DROP POLICY IF EXISTS "Anon read products" ON public.products;
DROP POLICY IF EXISTS "Authenticated insert products" ON public.products;
DROP POLICY IF EXISTS "Authenticated update products" ON public.products;
DROP POLICY IF EXISTS "Authenticated delete products" ON public.products;

-- Catalog (products.html) — read only
CREATE POLICY "Public read products"
ON public.products
FOR SELECT
TO public
USING (true);

-- CRUD (crud_products.html) — write only when logged in
CREATE POLICY "Authenticated insert products"
ON public.products
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated update products"
ON public.products
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated delete products"
ON public.products
FOR DELETE
TO authenticated
USING (true);

-- ----- Storage bucket Img -----
UPDATE storage.buckets SET public = true WHERE id = 'Img';

-- Remove anon write access (keep public read)
DROP POLICY IF EXISTS "Img insert anon" ON storage.objects;
DROP POLICY IF EXISTS "Img update anon" ON storage.objects;

-- Ensure read + authenticated write exist
DROP POLICY IF EXISTS "Img public read" ON storage.objects;
CREATE POLICY "Img public read"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'Img');

DROP POLICY IF EXISTS "Img insert authenticated" ON storage.objects;
CREATE POLICY "Img insert authenticated"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'Img');

DROP POLICY IF EXISTS "Img update authenticated" ON storage.objects;
CREATE POLICY "Img update authenticated"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'Img')
WITH CHECK (bucket_id = 'Img');

DROP POLICY IF EXISTS "Img delete authenticated" ON storage.objects;
CREATE POLICY "Img delete authenticated"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'Img');
