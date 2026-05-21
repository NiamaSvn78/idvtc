-- Assignation collègue / bon envoyé par course (1, 2, 3…), pas par réservation entière
ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS "driverAssignmentsByCourse" jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN reservations."driverAssignmentsByCourse" IS
  'Par course: {"1":{"sentAt","sentTo","driverName","plate"}, "2":{...}}';
