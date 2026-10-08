/*
# Add referral_source column to profiles

Adds a `referral_source` text column to store how the user heard about
the platform (Twitter, Snapchat, affiliate, search engine, other).
This is collected at signup and stored in the profiles row.
*/

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_source text;
