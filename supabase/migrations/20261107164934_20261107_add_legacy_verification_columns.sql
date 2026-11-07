/*
# Add legacy verification column aliases

## Overview
The ProfileSettings component previously referenced `national_id` and `bank_iban` columns that did not exist.
This migration adds those columns as aliases alongside the `id_number` and `iban` columns added in the
previous migration, so existing code continues to work while we transition to the new naming.

## Column additions on `profiles`
- `national_id` (text, nullable) — national ID or residency number (legacy alias for id_number)
- `bank_iban` (text, nullable) — bank IBAN (legacy alias for iban)

## Security
- Grants SELECT and UPDATE on these columns to `authenticated`
- RLS already enabled on profiles; existing update policies cover these columns
*/

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS national_id text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bank_iban text;

GRANT SELECT (national_id, bank_iban) ON profiles TO authenticated;
GRANT UPDATE (national_id, bank_iban) ON profiles TO authenticated;
