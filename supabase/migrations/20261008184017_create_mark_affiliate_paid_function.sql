/*
# Create mark_affiliate_paid function

Admin-only function to mark bookings as affiliate-paid during payout
processing. The `is_affiliate_paid` column is protected from direct
client writes via REVOKE UPDATE, so this SECURITY DEFINER function
provides the legitimate update path.

## Security
- Derives the caller from auth.uid() — no caller-supplied actor parameter
- Only allows execution by users with role 'admin' or 'financial_manager'
- EXECUTE granted to authenticated, revoked from anon
*/

CREATE OR REPLACE FUNCTION mark_affiliate_paid(p_booking_ids uuid[])
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated int;
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = v_caller AND role IN ('admin', 'financial_manager')
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_booking_ids IS NULL OR array_length(p_booking_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE bookings
  SET is_affiliate_paid = true
  WHERE id = ANY(p_booking_ids)
    AND is_affiliate_paid = false;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

REVOKE EXECUTE ON FUNCTION mark_affiliate_paid(uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION mark_affiliate_paid(uuid[]) TO authenticated;
