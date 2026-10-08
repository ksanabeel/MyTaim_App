/*
# Grant UPDATE on referral_source to authenticated

Allows users to update their referral_source after signup if needed.
INSERT is already granted by default. Also grants UPDATE on referred_by
so the profile can be updated with the referrer at signup time.
*/

GRANT UPDATE (referral_source, referred_by, phone) ON profiles TO authenticated;
