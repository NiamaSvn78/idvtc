const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

/* ── STOCKAGE ── */
const DATA_DIR = path.join(__dirname, 'data');
const RES_FILE = path.join(DATA_DIR, 'reservations.json');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(RES_FILE)) fs.writeFileSync(RES_FILE, '[]');

const ADMIN_PWD = process.env.ADMIN_PWD || 'idvtc2024';
const BUFFER_MIN = 20; // marge sécurité entre deux courses

function readRes() {
  try { return JSON.parse(fs.readFileSync(RES_FILE, 'utf8')); }
  catch { return []; }
}
function writeRes(data) {
  fs.writeFileSync(RES_FILE, JSON.stringify(data, null, 2));
}
function timeToMin(t) {
  const [h, m] = (t || '00:00').split(':').map(Number);
  return h * 60 + m;
}
function minToTime(m) {
  return String(Math.floor(m / 60)).padStart(2,'0') + ':' + String(m % 60).padStart(2,'0');
}
function checkConflict(date, time, durationMin, excludeId = null) {
  const newStart = timeToMin(time);
  const newEnd   = newStart + Number(durationMin) + BUFFER_MIN;
  const dayRes   = readRes().filter(r =>
    r.date === date && r.status !== 'cancelled' && r.id !== excludeId
  );
  for (const r of dayRes) {
    const rStart = timeToMin(r.time);
    const rEnd   = rStart + Number(r.durationMin || 60) + BUFFER_MIN;
    if (newStart < rEnd && newEnd > rStart) return r;
  }
  return null;
}
function nextSlot(date, durationMin, afterTime = null) {
  const dayRes = readRes()
    .filter(r => r.date === date && r.status !== 'cancelled')
    .sort((a, b) => timeToMin(a.time) - timeToMin(b.time));
  const needed  = Number(durationMin) + BUFFER_MIN;
  /* Cherche le slot libéré après le conflit actuel, pas depuis 05:00 */
  const startMin = afterTime
    ? (() => {
        const req = timeToMin(afterTime);
        const blocking = dayRes.find(r => {
          const rs = timeToMin(r.time), re = rs + Number(r.durationMin||60) + BUFFER_MIN;
          return req < re && (req + needed) > rs;
        });
        return blocking ? timeToMin(blocking.time) + Number(blocking.durationMin||60) + BUFFER_MIN : req;
      })()
    : 5 * 60;
  for (let min = startMin; min <= 23 * 60 - needed; min += 15) {
    const end = min + needed;
    const conflict = dayRes.find(r => {
      const rs = timeToMin(r.time), re = rs + Number(r.durationMin||60) + BUFFER_MIN;
      return min < re && end > rs;
    });
    if (!conflict) return minToTime(min);
  }
  return null;
}

app.use(express.json());

/* ── API : VÉRIFICATION DISPONIBILITÉ ── */
app.post('/api/check-availability', (req, res) => {
  const { date, time, durationMin, excludeId } = req.body;
  if (!date || !time) return res.json({ available: true });
  const conflict = checkConflict(date, time, durationMin || 60, excludeId);
  if (conflict) {
    const next = nextSlot(date, durationMin || 60, time);
    return res.json({
      available: false,
      conflict: { ref: conflict.ref, trajet: conflict.trajet, time: conflict.time },
      nextSlot: next
    });
  }
  res.json({ available: true });
});

/* ── API : DISPONIBILITÉ JOURNÉE (vue client) ── */
app.get('/api/availability', (req, res) => {
  const { date } = req.query;
  if (!date) return res.json({ slots: [] });
  const dayRes = readRes().filter(r => r.date === date && r.status !== 'cancelled');
  const slots = dayRes.map(r => ({
    startMin: timeToMin(r.time),
    endMin:   timeToMin(r.time) + Number(r.durationMin || 60) + BUFFER_MIN
  }));
  res.json({ date, slots });
});

/* ── API : SAUVEGARDER RÉSERVATION (après paiement) ── */
app.post('/api/reservations', (req, res) => {
  const { date, time, durationMin } = req.body;
  const conflict = checkConflict(date, time, durationMin || 60);
  if (conflict) return res.status(409).json({ error: 'Créneau indisponible', conflict });
  const id = Date.now().toString(36).toUpperCase().slice(-8);
  const newRes = { ...req.body, id, createdAt: new Date().toISOString() };
  const all = readRes();
  all.push(newRes);
  writeRes(all);
  res.json({ ok: true, id });
});

/* ── ADMIN : lire toutes les réservations ── */
app.get('/api/reservations', (req, res) => {
  if (req.query.pwd !== ADMIN_PWD) return res.status(401).json({ error: 'Non autorisé' });
  res.json(readRes());
});

/* ── ADMIN : ajouter manuellement ── */
app.post('/api/reservations/manual', (req, res) => {
  const { pwd, ...data } = req.body;
  if (pwd !== ADMIN_PWD) return res.status(401).json({ error: 'Non autorisé' });
  const conflict = checkConflict(data.date, data.time, data.durationMin || 60);
  if (conflict) return res.status(409).json({ error: 'Créneau indisponible', conflict });
  const id = Date.now().toString(36).toUpperCase().slice(-8);
  const newRes = { ...data, id, status: 'confirmed', source: 'manual', createdAt: new Date().toISOString() };
  const all = readRes();
  all.push(newRes);
  writeRes(all);
  res.json({ ok: true, id });
});

/* ── ADMIN : mettre à jour le statut ── */
app.patch('/api/reservations/:id', (req, res) => {
  const { pwd, ...updates } = req.body;
  if (pwd !== ADMIN_PWD) return res.status(401).json({ error: 'Non autorisé' });
  const all = readRes();
  const idx = all.findIndex(r => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Introuvable' });
  all[idx] = { ...all[idx], ...updates };
  writeRes(all);
  res.json({ ok: true });
});

/* ── PAGES ── */
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

const pages = [
  'a-propos','faq','chauffeur-prive-versailles','chauffeur-prive-neuilly-sur-seine',
  'chauffeur-prive-boulogne-billancourt','vtc-la-defense','vtc-vincennes',
  'transfert-roissy-cdg','transfert-orly-paris',
];
pages.forEach(slug => {
  app.get(`/${slug}`, (req, res) => res.sendFile(path.join(__dirname, 'public', `${slug}.html`)));
});

app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

app.listen(PORT, () => {
  console.log(`\n✅ Serveur démarré : http://localhost:${PORT}`);
  console.log(`   Admin            : http://localhost:${PORT}/admin\n`);
});
