/*
# Fix column-level privileges on bookings financial flags

The previous migration used REVOKE UPDATE (col) but the table-level
GRANT UPDATE still grants UPDATE on all columns, overriding the column
revocation. This migration fixes it by:
1. Revoking table-level UPDATE from authenticated
2. Granting UPDATE on all columns EXCEPT is_commission_paid and is_affiliate_paid

This ensures the financial flags can only be set through the
mark_commission_paid and mark_affiliate_paid SECURITY DEFINER functions.
*/

REVOKE UPDATE ON bookings FROM authenticated;

GRANT UPDATE (
  id, offering_id, customer_id, provider_id,
  appointment_date, end_time, location, quantity, status,
  client_contact, proposed_price, extra_details, additional_costs,
  rating, review, review_text, review_comment, client_review,
  comment, feedback, is_manual_booking, is_comment_hidden,
  is_archived_by_provider, is_archived_by_client, created_at
) ON bookings TO authenticated;
