ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS "cancellationToken"      text,
  ADD COLUMN IF NOT EXISTS "cancelledAt"             timestamptz,
  ADD COLUMN IF NOT EXISTS "refundAmount"            numeric,
  ADD COLUMN IF NOT EXISTS "stripePaymentIntentId"   text,
  ADD COLUMN IF NOT EXISTS "stripeRefundId"          text;

CREATE INDEX IF NOT EXISTS reservations_cancellation_token_idx
  ON reservations ("cancellationToken");
