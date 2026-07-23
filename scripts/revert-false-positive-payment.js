/**
 * Corrige une réservation confirmée à tort par un événement Stripe TEST.
 * Repasse status/paymentStatus à leur état réel (paiement non confirmé).
 *
 * Usage : node scripts/revert-false-positive-payment.js ISMA-WH2JMO
 */
require('dotenv').config({ path: 'vtc-project/.env.local' });
const { createClient } = require('@supabase/supabase-js');

const ref = process.argv[2];
if (!ref) {
  console.error('Usage: node scripts/revert-false-positive-payment.js <ref>');
  process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const { data: r, error: findErr } = await supabase
    .from('reservations')
    .select('id, ref, client, date, time, price, paymentStatus, status, stripeSessionId')
    .eq('ref', ref)
    .single();

  if (findErr || !r) {
    console.error('Réservation introuvable pour ref=' + ref, findErr?.message || '');
    process.exit(1);
  }

  if (!String(r.stripeSessionId || '').startsWith('cs_test_')) {
    console.error('Refus : cette réservation n\'a pas de session Stripe TEST (sessionId=' + r.stripeSessionId + '). Annulation par sécurité.');
    process.exit(1);
  }

  console.log('Avant correction:', r);

  const { error: updErr } = await supabase
    .from('reservations')
    .update({
      status: 'pending_payment',
      paymentStatus: 'unpaid',
      paidAt: null,
    })
    .eq('id', r.id);

  if (updErr) {
    console.error('Échec mise à jour:', updErr.message);
    process.exit(1);
  }

  console.log(`OK — ${r.ref} repassée en pending_payment / unpaid (sessionId TEST conservé pour trace : ${r.stripeSessionId}).`);
})();
