-- Reload PostgREST schema cache so newly-added columns are visible to the API layer
-- This fixes "Could not find the 'iban' column of 'profiles' in the schema cache" errors

NOTIFY pgrst, 'reload schema';
