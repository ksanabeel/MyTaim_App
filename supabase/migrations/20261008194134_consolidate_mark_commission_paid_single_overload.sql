/*
# Consolidate mark_commission_paid to a single text overload

PostgREST does not support calling overloaded functions unambiguously
via the /rpc endpoint — having two functions with the same name causes
a 404 or 300 Multiple Choices response regardless of which argument
type is passed.

## Changes
- Drop the uuid[] overload entirely.
- Keep and strengthen the text overload so it handles:
  - A single UUID string ("abc-123-...")
  - Comma-separated UUID strings ("abc-..., def-...")
- Ownership check is preserved: only the customer or provider of the
  booking may mark it as paid.
- EXECUTE granted to anon + authenticated (anon callers are still
  rejected at runtime because the function checks auth.uid() is not null).

## Security
- No financial flag is exposed through direct table UPDATE.
- The function is SECURITY DEFINER so it can write is_commission_paid
  even though authenticated users have that column's UPDATE revoked.
*/

DROP FUNCTION IF EXISTS public.mark_commission_paid(uuid[]);

CREATE OR REPLACE FUNCTION public.mark_commission_paid(p_booking_ids text)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ids   uuid[];
  v_updated int;
  v_caller  uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_booking_ids IS NULL OR btrim(p_booking_ids) = '' THEN
    RETURN 0;
  END IF;

  SELECT array_agg(btrim(raw_id)::uuid)
  INTO v_ids
  FROM unnest(string_to_array(p_booking_ids, ',')) AS raw_id
  WHERE btrim(raw_id) <> '';

  IF v_ids IS NULL OR array_length(v_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE bookings
  SET is_commission_paid = true
  WHERE id = ANY(v_ids)
    AND is_commission_paid = false
    AND (
      customer_id = v_caller
      OR provider_id = v_caller
      OR EXISTS (
        SELECT 1 FROM offerings
        WHERE offerings.id = bookings.offering_id
          AND offerings.provider_id = v_caller
      )
    );

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
EXCEPTION
  WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Invalid booking id format';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_commission_paid(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.mark_commission_paid(text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
