/*
# Add missing columns to platform_settings

## Summary
The PlatformManagement component and App.jsx read and write several columns
that do not exist in the `platform_settings` table, causing HTTP 400 errors
("Could not find the 'X' column of 'platform_settings' in the schema cache")
when saving settings or policies.

## Changes
1. New columns added to `platform_settings`:
   - `hero_subtitle_ar` (text) — Arabic hero subtitle (code uses this instead of `subtitle_ar`)
   - `hero_subtitle_en` (text) — English hero subtitle
   - `terms_text_ar` (text) — Arabic terms-of-use text
   - `terms_text_en` (text) — English terms-of-use text
   - `privacy_text_ar` (text) — Arabic privacy policy text
   - `privacy_text_en` (text) — English privacy policy text
   - `refund_text_ar` (text) — Arabic refund policy text
   - `refund_text_en` (text) — English refund policy text

2. Data migration: copy existing values from `subtitle_ar`/`subtitle_en`
   into the new `hero_subtitle_ar`/`hero_subtitle_en` columns for the
   single settings row (id = 1), so no existing data is lost.

3. No security changes — the table already has RLS enabled and existing
   policies remain in effect.

## Important notes
- All new columns are nullable text columns with no defaults.
- The old `subtitle_ar`, `subtitle_en`, `policies_ar`, `policies_en`
  columns are left untouched (not dropped) to preserve data.
- Idempotent: uses `IF NOT EXISTS` checks via DO block.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'platform_settings' AND column_name = 'hero_subtitle_ar'
  ) THEN
    ALTER TABLE platform_settings ADD COLUMN hero_subtitle_ar text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'platform_settings' AND column_name = 'hero_subtitle_en'
  ) THEN
    ALTER TABLE platform_settings ADD COLUMN hero_subtitle_en text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'platform_settings' AND column_name = 'terms_text_ar'
  ) THEN
    ALTER TABLE platform_settings ADD COLUMN terms_text_ar text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'platform_settings' AND column_name = 'terms_text_en'
  ) THEN
    ALTER TABLE platform_settings ADD COLUMN terms_text_en text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'platform_settings' AND column_name = 'privacy_text_ar'
  ) THEN
    ALTER TABLE platform_settings ADD COLUMN privacy_text_ar text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'platform_settings' AND column_name = 'privacy_text_en'
  ) THEN
    ALTER TABLE platform_settings ADD COLUMN privacy_text_en text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'platform_settings' AND column_name = 'refund_text_ar'
  ) THEN
    ALTER TABLE platform_settings ADD COLUMN refund_text_ar text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'platform_settings' AND column_name = 'refund_text_en'
  ) THEN
    ALTER TABLE platform_settings ADD COLUMN refund_text_en text;
  END IF;
END $$;

UPDATE platform_settings
SET hero_subtitle_ar = COALESCE(hero_subtitle_ar, subtitle_ar),
    hero_subtitle_en = COALESCE(hero_subtitle_en, subtitle_en)
WHERE id = 1;
