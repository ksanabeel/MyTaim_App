/*
# Create get_email_by_phone function

Allows the login screen to resolve a phone number to the associated
auth email so users can sign in with phone+password. The anon client
cannot call auth.admin, so this SECURITY DEFINER function performs
the lookup with owner privileges.

## Security
- Only returns the email, never the user ID or other auth data
- Does not expose passwords, tokens, or session data
- EXECUTE granted to anon + authenticated (login is a pre-auth operation)
*/

CREATE OR REPLACE FUNCTION get_email_by_phone(p_phone text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  SELECT au.email INTO v_email
  FROM auth.users au
  INNER JOIN profiles p ON p.id = au.id
  WHERE p.phone = p_phone
  LIMIT 1;

  RETURN v_email;
END;
$$;

REVOKE EXECUTE ON FUNCTION get_email_by_phone(text) FROM anon;
GRANT EXECUTE ON FUNCTION get_email_by_phone(text) TO anon, authenticated;
