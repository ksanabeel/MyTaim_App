/*
# Update handle_new_user trigger to capture signup fields

Updates the trigger function to read username, phone, referral_source,
and referred_by from raw_user_meta_data so they get written to the
profiles row at signup time.

referred_by is looked up by username — the frontend will pass the
referrer's UUID if found, so the trigger just needs to insert it.
*/

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, full_name, username, phone, referral_source, referred_by)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    COALESCE(new.raw_user_meta_data->>'username', NULL),
    COALESCE(new.raw_user_meta_data->>'phone', NULL),
    COALESCE(new.raw_user_meta_data->>'referral_source', NULL),
    NULLIF(new.raw_user_meta_data->>'referred_by', '')::uuid
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    username = COALESCE(EXCLUDED.username, profiles.username),
    phone = COALESCE(EXCLUDED.phone, profiles.phone),
    referral_source = COALESCE(EXCLUDED.referral_source, profiles.referral_source),
    referred_by = COALESCE(EXCLUDED.referred_by, profiles.referred_by);
  RETURN new;
END;
$$;
