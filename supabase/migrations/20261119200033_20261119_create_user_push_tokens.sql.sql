/*
# Create user_push_tokens table

1. New Tables
- `user_push_tokens`
  - `id` (uuid, primary key)
  - `user_id` (uuid, foreign key to auth.users, ON DELETE CASCADE)
  - `token` (text, the device push token from APNs/FCM)
  - `platform` (text, 'ios' or 'android')
  - `created_at` (timestamptz, defaults to now())
  - `updated_at` (timestamptz, defaults to now())
  - Unique constraint on (user_id, token) so re-registering the same device doesn't create duplicates.

2. Security
- Enable RLS on `user_push_tokens`.
- Grant CRUD to `authenticated` only (requires sign-in).
- Owner-scoped CRUD: each authenticated user can only manage their own push tokens.
- `user_id` defaults to `auth.uid()` so inserts that omit it still pass the WITH CHECK.
*/

CREATE TABLE IF NOT EXISTS user_push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('ios', 'android')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, token)
);

ALTER TABLE user_push_tokens ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON user_push_tokens TO authenticated;

DROP POLICY IF EXISTS "select_own_push_tokens" ON user_push_tokens;
CREATE POLICY "select_own_push_tokens" ON user_push_tokens FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_push_tokens" ON user_push_tokens;
CREATE POLICY "insert_own_push_tokens" ON user_push_tokens FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_push_tokens" ON user_push_tokens;
CREATE POLICY "update_own_push_tokens" ON user_push_tokens FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_push_tokens" ON user_push_tokens;
CREATE POLICY "delete_own_push_tokens" ON user_push_tokens FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
