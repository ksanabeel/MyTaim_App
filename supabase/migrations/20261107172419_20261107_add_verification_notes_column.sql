-- Add verification_notes column to profiles
-- Allows admins to attach feedback notes when approving/rejecting verification requests

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS verification_notes text;

COMMENT ON COLUMN profiles.verification_notes IS 'Admin feedback note attached when a verification request is approved or rejected';
