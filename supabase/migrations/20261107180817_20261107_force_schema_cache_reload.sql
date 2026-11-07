-- Force PostgREST schema cache reload using a DDL no-op that invalidates the cache
-- NOTIFY alone may not have taken effect if PostgREST wasn't listening at the time

-- Touch the table to force catalog update (comment change triggers cache invalidation)
COMMENT ON TABLE public.profiles IS 'User profiles with verification fields: iban, id_number, id_document_url, iban_document_url, verification_status, verification_notes';

-- Explicitly reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- Also grant table-level UPDATE to ensure PostgREST sees the permission
GRANT UPDATE ON public.profiles TO authenticated;
GRANT UPDATE ON public.profiles TO anon;
