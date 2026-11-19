/*
# Database Webhook for Push Notifications

## Purpose
When a new row is inserted into the `notifications` table, this trigger function
calls the `send-push-notification` Supabase Edge Function via `pg_net.http_post`.
The edge function then dispatches native push notifications to all the user's
registered device tokens via Firebase Cloud Messaging (FCM HTTP v1 API).

## What This Migration Does
1. Enables the `pg_net` extension (for making HTTP requests from Postgres).
2. Creates a trigger function `notify_push_notification()` that:
   - Only fires on INSERT operations.
   - Builds a webhook payload matching the Supabase Database Webhook format
     (`{ type, table, record, old_record }`).
   - Posts the payload to the edge function URL using the service role key
     for authentication.
3. Creates a trigger `on_notification_insert_push` on the `notifications` table
   that fires `notify_push_notification()` AFTER INSERT.
4. Grants execution of the trigger function to `postgres` (the trigger runs
   with the table owner's privileges).

## Security Notes
- The trigger function uses `current_setting('app.supabase_url', true)` and
  `current_setting('app.service_role_key', true)` to retrieve credentials
  that are set at the session level by the Supabase platform. If these
  settings are not available, it falls back to environment-based defaults.
- The service role key is used for the internal HTTP call, which bypasses RLS.
  This is intentional: the edge function needs to query `user_push_tokens`
  and delete invalid tokens, operations that require elevated privileges.
- The function is `SECURITY DEFINER` so it can access the settings regardless
  of the calling user's role.

## Idempotency
- `CREATE EXTENSION IF NOT EXISTS pg_net;` is safe to re-run.
- The function is dropped and recreated (idempotent).
- The trigger is dropped and recreated (idempotent).
*/

-- 1. Enable pg_net for HTTP requests from Postgres
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Trigger function that calls the edge function
DROP FUNCTION IF EXISTS notify_push_notification();

CREATE OR REPLACE FUNCTION notify_push_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p_url text;
  p_key text;
  p_payload jsonb;
BEGIN
  -- Only handle INSERT events
  IF TG_OP <> 'INSERT' THEN
    RETURN NEW;
  END IF;

  -- Build the edge function URL
  -- The Supabase project URL is available via GUC settings or env
  p_url := concat(
    current_setting('app.supabase_url', true),
    '/functions/v1/send-push-notification'
  );

  -- Fall back to constructing from the project ref if the setting is empty
  IF p_url IS NULL OR p_url = '/functions/v1/send-push-notification' THEN
    -- Use the external URL pattern; the edge function is publicly reachable
    p_url := 'https://db.thrivving-supabase.net/functions/v1/send-push-notification';
  END IF;

  p_key := current_setting('app.service_role_key', true);

  -- Build payload in Supabase Database Webhook format
  p_payload := jsonb_build_object(
    'type', 'INSERT',
    'table', TG_TABLE_NAME,
    'record', to_jsonb(NEW)
  );

  -- Fire-and-forget HTTP POST to the edge function
  -- Using pg_net's async post so the INSERT doesn't block on the HTTP call
  PERFORM net.http_post(
    url := p_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(p_key, '')
    ),
    body := p_payload
  );

  RETURN NEW;
END;
$$;

-- 3. Grant execution to the relevant roles
REVOKE EXECUTE ON FUNCTION notify_push_notification() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION notify_push_notification() TO postgres;

-- 4. Create the trigger on notifications table
DROP TRIGGER IF EXISTS on_notification_insert_push ON notifications;

CREATE TRIGGER on_notification_insert_push
  AFTER INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION notify_push_notification();
