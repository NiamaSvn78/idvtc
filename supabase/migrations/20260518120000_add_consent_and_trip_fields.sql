-- Colonnes RGPD (consentement) + champs trajet manquants
ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS "consentTimestamp" timestamptz,
  ADD COLUMN IF NOT EXISTS "policyVersion"    text,
  ADD COLUMN IF NOT EXISTS "tripMode"         text,
  ADD COLUMN IF NOT EXISTS "returnDate"       text,
  ADD COLUMN IF NOT EXISTS "returnTime"       text;
