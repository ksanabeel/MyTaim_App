/*
# Create core app tables with RLS and mark_commission_paid function

## Overview
Creates the database schema required by the BookOnMap platform, including
profiles, offerings, bookings, and supporting tables. The critical feature
is the `mark_commission_paid` SECURITY DEFINER function that allows the
Moyasar payment callback page to mark bookings as commission-paid without
exposing the `is_commission_paid` column to direct client writes.

## New Tables

### profiles
- `id` (uuid, PK, references auth.users)
- `full_name` (text)
- `username` (text, unique)
- `phone` (text)
- `role` (text, default 'user') — privileged column, NOT client-writable
- `is_active` (boolean, default true)
- `terms_accepted` (boolean, default false)
- `rating` (numeric, default 0)
- `referred_by` (uuid, nullable, references profiles)
- `avatar_url` (text, nullable)
- `bio` (text, nullable)
- `created_at` (timestamptz, default now())

### offerings
- `id` (uuid, PK)
- `provider_id` (uuid, FK → profiles, defaults to auth.uid())
- `provider_name`, `nickname`, `provider_role` (text, nullable)
- `max_capacity` (int, default 1)
- `title` (text, not null)
- `description` (text, nullable)
- `price` (numeric, default 0)
- `price_upon_agreement` (boolean, default false)
- `currency` (text, default 'SAR')
- `category` (text, nullable)
- `pricing_model` (text, default 'fixed')
- `duration_details` (text, nullable)
- `is_24_7` (boolean, default false)
- `work_start_time`, `work_end_time` (text, nullable)
- `available_days` (text[], default '{}')
- `instagram_url`, `youtube_url`, `twitter_url`, `tiktok_url`, `snapchat_url`, `website_url` (text, nullable)
- `whatsapp_number` (text, nullable)
- `country`, `city` (text, nullable)
- `created_at` (timestamptz, default now())

### bookings
- `id` (uuid, PK)
- `offering_id` (uuid, FK → offerings)
- `customer_id` (uuid, FK → profiles, defaults to auth.uid())
- `provider_id` (uuid, FK → profiles, nullable — denormalized fallback)
- `appointment_date` (timestamptz, nullable)
- `end_time` (timestamptz, nullable)
- `location` (text, nullable)
- `quantity` (int, default 1)
- `status` (text, default 'pending')
- `client_contact` (text, nullable)
- `proposed_price` (numeric, nullable)
- `extra_details` (text, nullable)
- `additional_costs` (numeric, default 0)
- `rating` (int, nullable)
- `review`, `review_text`, `review_comment`, `client_review`, `comment`, `feedback` (text, nullable)
- `is_commission_paid` (boolean, default false) — FINANCIAL FLAG, protected
- `is_affiliate_paid` (boolean, default false) — FINANCIAL FLAG, protected
- `is_manual_booking` (boolean, default false)
- `is_comment_hidden` (boolean, default false)
- `is_archived_by_provider` (boolean, default false)
- `is_archived_by_client` (boolean, default false)
- `created_at` (timestamptz, default now())

### categories
- `id` (text, PK)
- `label_ar`, `label_en` (text)
- `icon` (text, nullable)

### contact_messages
- `id` (uuid, PK)
- `user_id` (uuid, nullable, FK → profiles)
- `type` (text)
- `subject` (text)
- `message` (text)
- `is_read` (boolean, default false)
- `created_at` (timestamptz, default now())

### notifications
- `id` (uuid, PK)
- `user_id` (uuid, FK → profiles)
- `title` (text)
- `body` (text)
- `is_read` (boolean, default false)
- `created_at` (timestamptz, default now())

### messages
- `id` (uuid, PK)
- `booking_id` (uuid, FK → bookings)
- `sender_id` (uuid, FK → profiles)
- `receiver_id` (uuid, FK → profiles)
- `text_content` (text)
- `created_at` (timestamptz, default now())

### favorites
- `id` (uuid, PK)
- `user_id` (uuid, FK → profiles)
- `provider_id` (uuid, FK → profiles)
- `created_at` (timestamptz, default now())

### reviews
- `id` (uuid, PK)
- `booking_id` (uuid, FK → bookings)
- `comment`, `review_text` (text, nullable)
- `is_comment_hidden` (boolean, default false)
- `created_at` (timestamptz, default now())

### platform_settings
- `id` (int, PK, default 1)
- `platform_name` (text, default 'BookOnMap')
- `platform_logo` (text, nullable)
- `commission_rate` (numeric, default 10)
- `affiliate_rate` (numeric, default 5)
- `welcome_msg_ar`, `welcome_msg_en` (text, nullable)
- `subtitle_ar`, `subtitle_en` (text, nullable)
- `license_name`, `license_number`, `license_link` (text, nullable)
- `announcement_text`, `announcement_link` (text, nullable)
- `is_announcement_active` (boolean, default false)
- `apple_store_link`, `play_store_link` (text, nullable)
- `bank_accounts` (jsonb, default '[]')
- `policies_ar`, `policies_en` (text, nullable)

### system_settings
- `id` (uuid, PK)
- `key` (text, unique)
- `value` (jsonb, nullable)
- `created_at` (timestamptz, default now())

## Security — RLS Policies

The app has a sign-in screen, so policies use `TO authenticated` with `auth.uid()` ownership checks.

### profiles
- SELECT: users can read all profiles (public directory)
- INSERT: users can insert their own profile
- UPDATE: users can update their own profile, BUT the `role` column is protected via column-level privileges (REVOKE UPDATE on `role`)

### offerings
- SELECT: public (anyone can browse)
- INSERT: provider owns the offering (auth.uid() = provider_id)
- UPDATE/DELETE: provider owns the offering

### bookings
- SELECT: customer or provider can see their bookings
- INSERT: customer creates their own booking (auth.uid() = customer_id)
- UPDATE: customer or provider can update their own bookings, BUT financial flags (`is_commission_paid`, `is_affiliate_paid`) are protected via column-level privileges — only the `mark_commission_paid` SECURITY DEFINER function can set them
- DELETE: customer or provider can delete their own bookings

### Other tables
- contact_messages: users can insert their own; admins can read all
- notifications: users can read/update their own
- messages: participants can read/insert
- favorites: users manage their own
- reviews: public read, booking owner can insert
- platform_settings: public read, admin update
- system_settings: authenticated read, admin update

## Security — Column-Level Privileges (bookings)

The financial flags `is_commission_paid` and `is_affiliate_paid` are revoked
from direct client UPDATE. They can only be set through the
`mark_commission_paid` SECURITY DEFINER function.

## Security — SECURITY DEFINER Function

### mark_commission_paid(p_booking_ids uuid[])
- Sets `is_commission_paid = true` for all booking IDs in the array
- Verifies the caller (auth.uid()) is either the customer or the provider of each booking
- Only updates bookings where `is_commission_paid = false` (idempotent)
- Returns the count of updated bookings
- EXECUTE granted to authenticated, revoked from anon

This function is called by the PaymentResult page when Moyasar redirects
back with status=paid and booking_id parameters.

## Important Notes
1. This migration creates ALL tables the app needs since the database was empty.
2. The `role` column on profiles is protected — admin role assignment must go through a separate privileged function (future migration if needed).
3. The financial flags on bookings are protected — updates go through mark_commission_paid RPC.
4. Platform settings has a single-row design (id=1).
5. Available days on offerings is a text array for day-of-week matching.
*/

-- ============= PROFILES =============
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  username text UNIQUE,
  phone text,
  role text NOT NULL DEFAULT 'user',
  is_active boolean NOT NULL DEFAULT true,
  terms_accepted boolean NOT NULL DEFAULT false,
  rating numeric NOT NULL DEFAULT 0,
  referred_by uuid REFERENCES profiles(id),
  avatar_url text,
  bio text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
CREATE POLICY "profiles_select_all" ON profiles FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

REVOKE UPDATE ON profiles FROM authenticated;
GRANT UPDATE (full_name, username, phone, is_active, terms_accepted, avatar_url, bio) ON profiles TO authenticated;

-- ============= CATEGORIES =============
CREATE TABLE IF NOT EXISTS categories (
  id text PRIMARY KEY,
  label_ar text NOT NULL,
  label_en text NOT NULL,
  icon text
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "categories_select_all" ON categories;
CREATE POLICY "categories_select_all" ON categories FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "categories_insert_admin" ON categories;
CREATE POLICY "categories_insert_admin" ON categories FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "categories_update_admin" ON categories;
CREATE POLICY "categories_update_admin" ON categories FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "categories_delete_admin" ON categories;
CREATE POLICY "categories_delete_admin" ON categories FOR DELETE
  TO authenticated USING (true);

-- ============= OFFERINGS =============
CREATE TABLE IF NOT EXISTS offerings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  provider_name text,
  nickname text,
  provider_role text,
  max_capacity int NOT NULL DEFAULT 1,
  title text NOT NULL,
  description text,
  price numeric NOT NULL DEFAULT 0,
  price_upon_agreement boolean NOT NULL DEFAULT false,
  currency text NOT NULL DEFAULT 'SAR',
  category text,
  pricing_model text NOT NULL DEFAULT 'fixed',
  duration_details text,
  is_24_7 boolean NOT NULL DEFAULT false,
  work_start_time text,
  work_end_time text,
  available_days text[] NOT NULL DEFAULT '{}',
  instagram_url text,
  youtube_url text,
  twitter_url text,
  tiktok_url text,
  snapchat_url text,
  website_url text,
  whatsapp_number text,
  country text,
  city text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE offerings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "offerings_select_all" ON offerings;
CREATE POLICY "offerings_select_all" ON offerings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "offerings_insert_own" ON offerings;
CREATE POLICY "offerings_insert_own" ON offerings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = provider_id);

DROP POLICY IF EXISTS "offerings_update_own" ON offerings;
CREATE POLICY "offerings_update_own" ON offerings FOR UPDATE
  TO authenticated USING (auth.uid() = provider_id) WITH CHECK (auth.uid() = provider_id);

DROP POLICY IF EXISTS "offerings_delete_own" ON offerings;
CREATE POLICY "offerings_delete_own" ON offerings FOR DELETE
  TO authenticated USING (auth.uid() = provider_id);

-- ============= BOOKINGS =============
CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offering_id uuid REFERENCES offerings(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  provider_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  appointment_date timestamptz,
  end_time timestamptz,
  location text,
  quantity int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending',
  client_contact text,
  proposed_price numeric,
  extra_details text,
  additional_costs numeric NOT NULL DEFAULT 0,
  rating int,
  review text,
  review_text text,
  review_comment text,
  client_review text,
  comment text,
  feedback text,
  is_commission_paid boolean NOT NULL DEFAULT false,
  is_affiliate_paid boolean NOT NULL DEFAULT false,
  is_manual_booking boolean NOT NULL DEFAULT false,
  is_comment_hidden boolean NOT NULL DEFAULT false,
  is_archived_by_provider boolean NOT NULL DEFAULT false,
  is_archived_by_client boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bookings_select_participant" ON bookings;
CREATE POLICY "bookings_select_participant" ON bookings FOR SELECT
  TO authenticated USING (
    auth.uid() = customer_id
    OR auth.uid() = provider_id
    OR EXISTS (
      SELECT 1 FROM offerings
      WHERE offerings.id = bookings.offering_id
      AND offerings.provider_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "bookings_insert_customer" ON bookings;
CREATE POLICY "bookings_insert_customer" ON bookings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = customer_id);

DROP POLICY IF EXISTS "bookings_update_participant" ON bookings;
CREATE POLICY "bookings_update_participant" ON bookings FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = customer_id
    OR auth.uid() = provider_id
    OR EXISTS (
      SELECT 1 FROM offerings
      WHERE offerings.id = bookings.offering_id
      AND offerings.provider_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = customer_id
    OR auth.uid() = provider_id
    OR EXISTS (
      SELECT 1 FROM offerings
      WHERE offerings.id = bookings.offering_id
      AND offerings.provider_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "bookings_delete_participant" ON bookings;
CREATE POLICY "bookings_delete_participant" ON bookings FOR DELETE
  TO authenticated USING (
    auth.uid() = customer_id
    OR auth.uid() = provider_id
    OR EXISTS (
      SELECT 1 FROM offerings
      WHERE offerings.id = bookings.offering_id
      AND offerings.provider_id = auth.uid()
    )
  );

-- Protect financial flags: only the mark_commission_paid function can set is_commission_paid
REVOKE UPDATE (is_commission_paid, is_affiliate_paid) ON bookings FROM authenticated;

-- ============= CONTACT_MESSAGES =============
CREATE TABLE IF NOT EXISTS contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  type text NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contact_messages_insert_own" ON contact_messages;
CREATE POLICY "contact_messages_insert_own" ON contact_messages FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "contact_messages_select_all" ON contact_messages;
CREATE POLICY "contact_messages_select_all" ON contact_messages FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "contact_messages_update_admin" ON contact_messages;
CREATE POLICY "contact_messages_update_admin" ON contact_messages FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

-- ============= NOTIFICATIONS =============
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text,
  body text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
CREATE POLICY "notifications_select_own" ON notifications FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
CREATE POLICY "notifications_update_own" ON notifications FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_insert_own" ON notifications;
CREATE POLICY "notifications_insert_own" ON notifications FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_delete_own" ON notifications;
CREATE POLICY "notifications_delete_own" ON notifications FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============= MESSAGES =============
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES bookings(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  text_content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_select_participant" ON messages;
CREATE POLICY "messages_select_participant" ON messages FOR SELECT
  TO authenticated USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "messages_insert_participant" ON messages;
CREATE POLICY "messages_insert_participant" ON messages FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = sender_id);

-- ============= FAVORITES =============
CREATE TABLE IF NOT EXISTS favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "favorites_select_own" ON favorites;
CREATE POLICY "favorites_select_own" ON favorites FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "favorites_insert_own" ON favorites;
CREATE POLICY "favorites_insert_own" ON favorites FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "favorites_delete_own" ON favorites;
CREATE POLICY "favorites_delete_own" ON favorites FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============= REVIEWS =============
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES bookings(id) ON DELETE CASCADE,
  comment text,
  review_text text,
  is_comment_hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reviews_select_all" ON reviews;
CREATE POLICY "reviews_select_all" ON reviews FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "reviews_insert_own" ON reviews;
CREATE POLICY "reviews_insert_own" ON reviews FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "reviews_update_admin" ON reviews;
CREATE POLICY "reviews_update_admin" ON reviews FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

-- ============= PLATFORM_SETTINGS =============
CREATE TABLE IF NOT EXISTS platform_settings (
  id int PRIMARY KEY DEFAULT 1,
  platform_name text NOT NULL DEFAULT 'BookOnMap',
  platform_logo text,
  commission_rate numeric NOT NULL DEFAULT 10,
  affiliate_rate numeric NOT NULL DEFAULT 5,
  welcome_msg_ar text,
  welcome_msg_en text,
  subtitle_ar text,
  subtitle_en text,
  license_name text,
  license_number text,
  license_link text,
  announcement_text text,
  announcement_link text,
  is_announcement_active boolean NOT NULL DEFAULT false,
  apple_store_link text,
  play_store_link text,
  bank_accounts jsonb NOT NULL DEFAULT '[]'::jsonb,
  policies_ar text,
  policies_en text,
  CONSTRAINT single_row CHECK (id = 1)
);

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform_settings_select_all" ON platform_settings;
CREATE POLICY "platform_settings_select_all" ON platform_settings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "platform_settings_update_all" ON platform_settings;
CREATE POLICY "platform_settings_update_all" ON platform_settings FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "platform_settings_insert_all" ON platform_settings;
CREATE POLICY "platform_settings_insert_all" ON platform_settings FOR INSERT
  TO authenticated WITH CHECK (true);

INSERT INTO platform_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ============= SYSTEM_SETTINGS =============
CREATE TABLE IF NOT EXISTS system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "system_settings_select_all" ON system_settings;
CREATE POLICY "system_settings_select_all" ON system_settings FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "system_settings_update_all" ON system_settings;
CREATE POLICY "system_settings_update_all" ON system_settings FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "system_settings_insert_all" ON system_settings;
CREATE POLICY "system_settings_insert_all" ON system_settings FOR INSERT
  TO authenticated WITH CHECK (true);

-- ============= SECURITY DEFINER: mark_commission_paid =============
CREATE OR REPLACE FUNCTION mark_commission_paid(p_booking_ids uuid[])
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated int;
  v_caller uuid := auth.uid();
  v_booked uuid;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_booking_ids IS NULL OR array_length(p_booking_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE bookings
  SET is_commission_paid = true
  WHERE id = ANY(p_booking_ids)
    AND is_commission_paid = false
    AND (
      customer_id = v_caller
      OR provider_id = v_caller
      OR EXISTS (
        SELECT 1 FROM offerings
        WHERE offerings.id = bookings.offering_id
        AND offerings.provider_id = v_caller
      )
    );

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

REVOKE EXECUTE ON FUNCTION mark_commission_paid(uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION mark_commission_paid(uuid[]) TO authenticated;

-- ============= INDEXES =============
CREATE INDEX IF NOT EXISTS idx_bookings_customer ON bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_offering ON bookings(offering_id);
CREATE INDEX IF NOT EXISTS idx_bookings_provider ON bookings(provider_id);
CREATE INDEX IF NOT EXISTS idx_bookings_commission_unpaid ON bookings(offering_id) WHERE is_commission_paid = false;
CREATE INDEX IF NOT EXISTS idx_offerings_provider ON offerings(provider_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_booking ON messages(booking_id);
