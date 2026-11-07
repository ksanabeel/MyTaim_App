-- Grant UPDATE on verification_notes to authenticated
-- The column was added without the UPDATE grant, causing 400 errors
-- when users submit the verification form (which sets verification_notes: null)

GRANT UPDATE (verification_notes) ON profiles TO authenticated;
