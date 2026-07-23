/**
 * Audit ponctuel : repère les réservations marquées payées (paymentStatus === 'paid')
 * dont le stripeSessionId n'est PAS une session Stripe Live (cs_live_...).
 * Lecture seule — ne modifie rien dans Supabase.
 *
 * Usage : node scripts/audit-live-payments.js
 * Nécessite SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY dans l'environnement.
 */
require('dotenv').config({ path: 'vtc-project/.env.local' });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

function classify(sessionId) {
  const s = String(sessionId || '');
  if (s.startsWith('cs_live_')) return 'LIVE';
  if (s.startsWith('cs_test_')) return 'TEST';
  if (!s) return 'ABSENT';
  return 'INCONNU';
}

(async () => {
  const { data, error } = await supabase
    .from('reservations')
    .select('id, ref, client, date, time, price, paymentStatus, status, stripeSessionId, createdAt, paidAt')
    .eq('paymentStatus', 'paid')
    .order('createdAt', { ascending: true });

  if (error) {
    console.error('Erreur Supabase:', error.message);
    process.exit(1);
  }

  const rows = data || [];
  const counts = { LIVE: 0, TEST: 0, ABSENT: 0, INCONNU: 0 };
  const suspects = [];

  for (const r of rows) {
    const kind = classify(r.stripeSessionId);
    counts[kind]++;
    if (kind !== 'LIVE') suspects.push({ ...r, _kind: kind });
  }

  console.log(`Total réservations paymentStatus=paid : ${rows.length}`);
  console.log(`  - session Live confirmée : ${counts.LIVE}`);
  console.log(`  - session Test (FAUX POSITIF probable) : ${counts.TEST}`);
  console.log(`  - sans stripeSessionId : ${counts.ABSENT}`);
  console.log(`  - format inattendu : ${counts.INCONNU}`);
  console.log('');

  if (suspects.length) {
    console.log('── Détail des cas à vérifier ──');
    for (const s of suspects) {
      console.log(
        `[${s._kind}] ref=${s.ref || s.id} | ${s.date || '?'} ${s.time || ''} | ${s.price || '?'}€ | client=${s.client || '?'} | sessionId=${s.stripeSessionId || '(aucun)'} | payé le=${s.paidAt || '?'}`
      );
    }
  } else {
    console.log('Aucune anomalie détectée : toutes les réservations payées ont une session Stripe Live.');
  }
})();
