/**
 * Courses multiples dans une réservation (notes [Prestation N:…]) + page validation QR.
 */
const EXPLOITANT = {
  raisonSociale: 'ISMA TRANS',
  exploitant: 'DIABY ISMAILA',
  siret: process.env.SIRET || '849 624 374 00013',
  numeroREVTC: process.env.NUMERO_REVTC || 'EVTC075210338',
  telephone: '+33 6 23 88 97 17',
  email: 'contact@ismadrive.fr',
  adresse: '2 rue du Colonel Domine, 75013 Paris',
};

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtDateFr(iso) {
  if (!iso) return '—';
  const [y, mo, d] = iso.split('-');
  return `${d}/${mo}/${y}`;
}

function vehicleDisplayName(r) {
  const v = String(r.vehicle || '').toLowerCase();
  return v === 'van' ? 'Mercedes Classe V et équivalent' : 'Mercedes Classe E et équivalent';
}

function parsePrestationsFromNotes(notes) {
  if (!notes) return [];
  const regex = /\[Prestation \d+:([^\]]*)\]/g;
  const results = [];
  let m;
  while ((m = regex.exec(notes)) !== null) results.push(m[1].trim());
  return results;
}

function parsePrestationFields(detail) {
  const parts = detail.split(' · ').map((p) => p.trim());
  const dateTimeIdx = parts.findIndex((p) => /^\d{4}-\d{2}-\d{2}/.test(p));
  const raw = dateTimeIdx > -1 ? parts[dateTimeIdx] : '';
  const date = raw.substring(0, 10);
  const time = raw.length > 10 ? raw.substring(11, 16) : '';
  const priceMatch = detail.match(/(\d+)€/);
  const price = priceMatch ? priceMatch[1] : '—';
  const dirIdx = parts.findIndex((p) => p === 'Depuis aéroport' || p === 'Vers aéroport');
  const dir = dirIdx > -1 ? parts[dirIdx] : '';
  const addr = dirIdx > -1 && dirIdx + 1 < parts.length ? parts[dirIdx + 1] : '';
  const routeEnd = dirIdx > -1 ? dirIdx : dateTimeIdx > -1 ? dateTimeIdx : parts.length;
  const route = parts.slice(0, routeEnd).join(' · ');
  const dep = dir === 'Depuis aéroport' ? route : addr;
  const arr = dir === 'Depuis aéroport' ? addr : route;
  return { date, time, price, route, addr, dir, dep, arr };
}

/** Une entrée calendrier / email par course (1 = principale, 2+ = prestations). */
function expandReservationToCourses(r) {
  if (!r) return [];
  const courses = [{
    reservation: r,
    courseIdx: 1,
    date: r.date,
    time: r.time,
    trajet: r.trajet,
    price: r.price,
    durationMin: Number(r.durationMin) || 60,
    label: 'Course 1',
  }];
  parsePrestationsFromNotes(r.notes).forEach((detail, i) => {
    const pf = parsePrestationFields(detail);
    const num = i + 2;
    courses.push({
      reservation: r,
      courseIdx: num,
      date: pf.date || r.date,
      time: pf.time || '',
      trajet: pf.route || r.trajet,
      price: pf.price && pf.price !== '—' ? Number(pf.price) : r.price,
      durationMin: 60,
      label: `Course ${num}`,
      detail,
    });
  });
  return courses;
}

function reservationUrl(appUrl, reservationId, courseIdx) {
  const base = `${String(appUrl).replace(/\/$/, '')}/reservation/${reservationId}`;
  if (!courseIdx || courseIdx <= 1) return base;
  return `${base}?course=${courseIdx}`;
}

function applyCourseToReservation(r, courseIdx) {
  if (!r || !courseIdx || courseIdx <= 1) return r;
  const prests = parsePrestationsFromNotes(r.notes);
  const detail = prests[courseIdx - 2];
  if (!detail) return r;
  const pf = parsePrestationFields(detail);
  const dep = pf.dep || (pf.route || '').split(/[→>]/)[0]?.trim();
  const arr = pf.arr || (pf.route || '').split(/[→>]/)[1]?.trim();
  return {
    ...r,
    date: pf.date || r.date,
    time: pf.time || r.time,
    trajet: pf.route || r.trajet,
    depLabel: dep || r.depLabel,
    arrLabel: arr || r.arrLabel,
    _courseIdx: courseIdx,
    _courseLabel: `Course ${courseIdx}`,
  };
}

function buildReservationValidationHtml(r, courseIdx) {
  const isValid = r && r.status !== 'cancelled' && (r.status === 'confirmed' || r.paymentStatus === 'paid' || !!r.paidAt);
  if (!isValid) {
    return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Réservation invalide — IsmaDrive</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;background:#f0f0f0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px}.card{background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.12);width:100%;max-width:420px}.banner{background:#c0392b;color:#fff;padding:28px 24px;text-align:center}.icon{font-size:2.8rem;display:block;margin-bottom:10px}.title{font-size:1.3rem;font-weight:bold}.body{padding:24px;text-align:center;color:#555;line-height:1.6;font-size:.95rem}</style>
</head><body><div class="card"><div class="banner"><span class="icon">❌</span><div class="title">RÉSERVATION NON VALIDE</div></div>
<div class="body"><p>Ce QR code ne correspond à aucune réservation confirmée.</p>
<p style="margin-top:12px;font-size:.82rem;color:#aaa">IsmaDrive — Chauffeur Privé Paris &amp; Île-de-France</p></div></div></body></html>`;
  }

  const view = applyCourseToReservation(r, courseIdx);
  const ref = escHtml(view.ref || view.id || '');
  const dep = escHtml(view.depLabel || (view.trajet || '').split(/[→>]/)[0]?.trim() || '—');
  const arr = escHtml(view.arrLabel || (view.trajet || '').split(/[→>]/)[1]?.trim() || '—');
  const dateStr = escHtml(fmtDateFr(view.date));
  const time = escHtml(view.time || '—');
  const veh = escHtml(vehicleDisplayName(view));
  const tel = view.tel || '';
  const prix = Number(view.price || 0);
  const ht = (prix / 1.1).toFixed(2);
  const tva = (prix - Number(ht)).toFixed(2);
  const ttc = prix.toFixed(2);
  const courseBadge = view._courseIdx > 1
    ? `<div style="font-size:.75rem;opacity:.85;margin-top:6px">${escHtml(view._courseLabel)}</div>`
    : '';
  const nomAbrege = (view.client || '—').split(' ')
    .map((w, i) => (i === 0 ? w[0] + '.' : w)).join(' ');

  return `<!DOCTYPE html><html lang="fr"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Réservation ${ref} — IsmaDrive</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,Helvetica,sans-serif;background:#f0f0f0;color:#111;min-height:100vh;padding:12px}
.card{max-width:480px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 20px rgba(0,0,0,.13)}
.banner{background:#1a7a3c;color:#fff;padding:20px 22px;text-align:center}
.b-icon{font-size:2.4rem;display:block;margin-bottom:8px}
.b-title{font-size:1.25rem;font-weight:bold;letter-spacing:.03em}
.b-ref{font-size:.95rem;opacity:.9;margin-top:5px;font-family:monospace;letter-spacing:.08em}
.sec{padding:14px 20px;border-bottom:1px solid #eee}
.row{display:flex;justify-content:space-between;align-items:baseline;padding:5px 0;font-size:.9rem}
.row:not(:last-child){border-bottom:1px solid #f8f8f8}
.k{color:#777;flex-shrink:0;padding-right:12px}
.v{font-weight:600;text-align:right;word-break:break-word}
.v.ok{color:#1a7a3c}
.footer{background:#fafafa;padding:10px 20px;font-size:.68rem;color:#aaa;text-align:center;border-top:1px solid #eee}
</style></head><body>
<div class="card">
  <div class="banner">
    <span class="b-icon">✅</span>
    <div class="b-title">RÉSERVATION VALIDÉE</div>
    <div class="b-ref">${ref}</div>
    ${courseBadge}
  </div>
  <div class="sec">
    <div class="row"><span class="k">Client</span><span class="v">${escHtml(nomAbrege)}</span></div>
    <div class="row"><span class="k">Téléphone</span><span class="v"><a href="tel:${escHtml(tel)}" style="color:inherit;text-decoration:none">${escHtml(tel || '—')}</a></span></div>
  </div>
  <div class="sec">
    <div class="row"><span class="k">Départ</span><span class="v">${dep}</span></div>
    <div class="row"><span class="k">Arrivée</span><span class="v">${arr}</span></div>
    <div class="row"><span class="k">Date</span><span class="v">${dateStr}</span></div>
    <div class="row"><span class="k">Heure</span><span class="v">${time}</span></div>
  </div>
  <div class="sec">
    <div class="row"><span class="k">Véhicule</span><span class="v">${veh}</span></div>
    <div class="row"><span class="k">Montant HT</span><span class="v">${ht} €</span></div>
    <div class="row"><span class="k">TVA 10 %</span><span class="v">${tva} €</span></div>
    <div class="row"><span class="k">Total TTC</span><span class="v ok">${ttc} € ✓ PAYÉ</span></div>
  </div>
  <div class="sec">
    <div class="row"><span class="k">Exploitant</span><span class="v">${escHtml(EXPLOITANT.raisonSociale)}</span></div>
    <div class="row"><span class="k">N° REVTC</span><span class="v">${escHtml(EXPLOITANT.numeroREVTC)}</span></div>
  </div>
  <div class="sec" style="text-align:center;background:#fafafa">
    <button onclick="window.print()" style="background:#1a7a3c;color:#fff;border:none;padding:11px 28px;font-size:.85rem;font-weight:bold;cursor:pointer;border-radius:6px;width:100%;font-family:Arial,sans-serif">⬇ Télécharger / Imprimer ce bon</button>
  </div>
  <div class="footer">Conforme arrêté du 6 août 2025 · IsmaDrive</div>
</div>
<style>@media print{button{display:none}}</style>
</body></html>`;
}

module.exports = {
  EXPLOITANT,
  escHtml,
  fmtDateFr,
  vehicleDisplayName,
  parsePrestationsFromNotes,
  parsePrestationFields,
  expandReservationToCourses,
  reservationUrl,
  applyCourseToReservation,
  buildReservationValidationHtml,
};
