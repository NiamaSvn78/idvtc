ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS "returnAddr" text;
