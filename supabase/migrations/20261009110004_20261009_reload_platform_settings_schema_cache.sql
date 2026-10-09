/*
# Ensure logo_url exists and reload the API schema cache

## Summary
The platform settings save request is failing because the Supabase API schema
cache in the deployed environment does not currently expose `logo_url`.
This migration safely ensures the column exists and asks PostgREST to reload
its schema cache immediately.

## Changes
1. Modified table: `platform_settings`
   - Ensure `logo_url` exists as a nullable `text` column.
2. Schema cache
   - Send the PostgREST schema reload notification after the DDL change.

## Security changes
- None. Existing table permissions and RLS policies are unchanged.

## Important notes
- The column addition is idempotent and does not remove or alter existing data.
- The notification is safe to repeat and does not change stored data.
*/

ALTER TABLE platform_settings
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

NOTIFY pgrst, 'reload schema';
