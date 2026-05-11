CREATE TABLE IF NOT EXISTS reservations (
  id              text PRIMARY KEY,
  ref             text,
  status          text DEFAULT 'confirmed',
  type            text,
  trajet          text,
  date            text,
  "time"          text,
  "durationMin"   integer DEFAULT 60,
  vehicle         text,
  "vehicleName"   text,
  equipment       text,
  client          text,
  tel             text,
  email           text,
  price           numeric,
  notes           text,
  source          text DEFAULT 'web',
  "paymentMethod" text,
  "createdAt"     timestamptz DEFAULT now()
);

ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
