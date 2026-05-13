-- Suivi envoi bon de commande au collègue (évite les doubles envois involontaires côté admin)
ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS "driverOrderSentAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "driverOrderSentTo" text;
