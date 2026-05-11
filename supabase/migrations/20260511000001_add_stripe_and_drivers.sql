-- Colonnes Stripe et données complètes de réservation
ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS "paymentStatus" text DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS "stripeSessionId" text,
  ADD COLUMN IF NOT EXISTS "paidAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "depLabel" text,
  ADD COLUMN IF NOT EXISTS "depLat" numeric,
  ADD COLUMN IF NOT EXISTS "depLon" numeric,
  ADD COLUMN IF NOT EXISTS "arrLabel" text,
  ADD COLUMN IF NOT EXISTS "arrLat" numeric,
  ADD COLUMN IF NOT EXISTS "arrLon" numeric,
  ADD COLUMN IF NOT EXISTS lang text DEFAULT 'fr',
  ADD COLUMN IF NOT EXISTS "fpack" text,
  ADD COLUMN IF NOT EXISTS "fveh" text;

-- Table conducteurs
CREATE TABLE IF NOT EXISTS drivers (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  email       text NOT NULL UNIQUE,
  phone       text DEFAULT '',
  "carCategory" text DEFAULT '',
  "createdAt" timestamptz DEFAULT now()
);

ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
