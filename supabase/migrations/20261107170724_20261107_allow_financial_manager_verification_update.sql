/*
# Allow financial_manager role to update verification status

## Overview
The previous migration only allowed admin/مدير roles to update verification_status.
The Verified Accounts Report is accessible to both admin and financial_manager roles,
so financial_manager must also be able to approve/reject/reset verification status.

## Security
- Replaces the "Admins update verification status" policy with one that also allows financial_manager
- No other changes
*/

DROP POLICY IF EXISTS "Admins update verification status" ON profiles;
DROP POLICY IF EXISTS "Admins and financial managers update verification status" ON profiles;

CREATE POLICY "Admins and financial managers update verification status"
ON profiles FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND (p.role = 'admin' OR p.role = 'مدير' OR p.role = 'financial_manager')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND (p.role = 'admin' OR p.role = 'مدير' OR p.role = 'financial_manager')
  )
);
