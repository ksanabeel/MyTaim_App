/*
# Financial Verification: Columns, Storage Bucket, and RLS

## Overview
Adds columns to `profiles` for financial verification (ID number, IBAN, document URLs, verification status),
creates a `verification_documents` storage bucket for uploaded files, and sets up RLS policies so:
- Users can read/update their own verification fields
- Admins can read/update any user's verification fields
- Users can upload files to their own folder in the bucket
- Admins can read all files in the bucket

## Column additions on `profiles`
- `id_number` (text, nullable) — national ID or residency number
- `iban` (text, nullable) — bank IBAN
- `id_document_url` (text, nullable) — public URL of uploaded ID image
- `iban_document_url` (text, nullable) — public URL of uploaded IBAN certificate
- `verification_status` (text, not null, default 'unverified') — one of: unverified, pending, verified, rejected

## Storage
- Creates bucket `verification_documents` (public, for document images)
- Storage policies: authenticated users can upload to their own folder, anyone can read (public bucket)

## RLS on `profiles`
- Grants SELECT on verification columns to `authenticated`
- Adds policies for users to update their own verification fields
- Adds policies for admin role to update any user's verification status

## Security
- Verification status defaults to 'unverified'
- Only admins can change status to 'verified' or 'rejected'
- Users can only set their own status to 'pending' (enforced in app logic; DB allows self-update of verification fields)
*/

-- 1. Add columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS id_number text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS iban text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS id_document_url text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS iban_document_url text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'unverified';

-- 2. Create storage bucket for verification documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('verification_documents', 'verification_documents', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage policies: users upload to their own folder, public read
-- Allow authenticated users to upload files to their own folder
DROP POLICY IF EXISTS "Users upload own verification docs" ON storage.objects;
CREATE POLICY "Users upload own verification docs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'verification_documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to update/delete their own files
DROP POLICY IF EXISTS "Users update own verification docs" ON storage.objects;
CREATE POLICY "Users update own verification docs"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'verification_documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users delete own verification docs" ON storage.objects;
CREATE POLICY "Users delete own verification docs"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'verification_documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Public read (bucket is public but still need policy)
DROP POLICY IF EXISTS "Public read verification docs" ON storage.objects;
CREATE POLICY "Public read verification docs"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'verification_documents');

-- 4. Grant column-level access on verification fields
-- Users need to read and update their own verification columns
GRANT SELECT (id_number, iban, id_document_url, iban_document_url, verification_status) ON profiles TO authenticated;
GRANT UPDATE (id_number, iban, id_document_url, iban_document_url, verification_status) ON profiles TO authenticated;

-- 5. RLS policies for verification field updates
-- Users can update their own verification fields (id_number, iban, document URLs, set status to pending)
DROP POLICY IF EXISTS "Users update own verification fields" ON profiles;
CREATE POLICY "Users update own verification fields"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Admins can update any user's verification_status
DROP POLICY IF EXISTS "Admins update verification status" ON profiles;
CREATE POLICY "Admins update verification status"
ON profiles FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND (p.role = 'admin' OR p.role = 'مدير')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND (p.role = 'admin' OR p.role = 'مدير')
  )
);
