-- Colonnes utilisées par /api/send-driver-email (bon de commande collègue)
ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS "assignedDriverName" text,
  ADD COLUMN IF NOT EXISTS "assignedDriverPlate" text;

ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS immatriculation text DEFAULT '';
