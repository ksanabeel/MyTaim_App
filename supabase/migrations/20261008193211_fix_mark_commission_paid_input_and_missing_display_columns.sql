/*
# Fix payment callback RPC input and missing display columns

1. Functions
- Add `mark_commission_paid(text)` so the payment callback can send the
  raw `booking_id` query-string value exactly as received.
- Accept one UUID or comma-separated UUIDs, validate each value, convert
  them to `uuid[]`, and reuse the existing ownership-protected update.

2. Modified Tables
- Add `categories.created_at` with a timestamp default because the app
  sorts categories by this column.
- Add `platform_settings.logo_url` because the marketplace reads the
  public platform logo from this column.
- Copy any existing `platform_logo` value into `logo_url` when empty.

3. Security
- Grant EXECUTE on the text overload to `anon` and `authenticated` as
  requested so PostgREST can resolve the RPC before authentication.
- The function still requires an authenticated caller before changing a
  booking and keeps the existing customer/provider ownership checks.
- No financial flag is exposed through direct table updates.

4. Important Notes
- Granting EXECUTE to anon only permits calling the function; it does not
  permit anonymous commission updates because the function rejects callers
  without an authenticated user identity.
- Invalid UUID input raises a clear database error instead of silently
  updating the wrong booking.
*/

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE platform_settings
  ADD COLUMN IF NOT EXISTS logo_url text;

UPDATE platform_settings
SET logo_url = platform_logo
WHERE logo_url IS NULL
  AND platform_logo IS NOT NULL;

CREATE OR REPLACE FUNCTION mark_commission_paid(p_booking_ids text)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ids uuid[];
BEGIN
  IF p_booking_ids IS NULL OR btrim(p_booking_ids) = '' THEN
    RETURN 0;
  END IF;

  SELECT array_agg(trimmed_id::uuid)
  INTO v_ids
  FROM unnest(string_to_array(p_booking_ids, ',')) AS raw_id
  CROSS JOIN LATERAL (SELECT btrim(raw_id) AS trimmed_id) AS normalized
  WHERE btrim(raw_id) <> '';

  RETURN mark_commission_paid(v_ids);
EXCEPTION
  WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Invalid booking id';
END;
$$;

REVOKE EXECUTE ON FUNCTION mark_commission_paid(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mark_commission_paid(text) TO anon, authenticated;
