ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS "confirmationEmailSent" boolean DEFAULT false;
