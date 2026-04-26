// Point d'entrée pour Vercel - serveur Express adapté
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();

/* ── STOCKAGE ── */
const DATA_DIR = path.join(__dirname, 'vtc-project/data');
const RES_FILE = path.join(DATA_DIR, 'reservations.json');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(RES_FILE)) fs.writeFileSync(RES_FILE, '[]');

const ADMIN_PWD = process.env.ADMIN_PWD || 'idvtc2024';
const BUFFER_MIN = 20;

// Fonctions utilitaires
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

app.use(express.json());

/* ── API : VÉRIFICATION DISPONIBILITÉ ── */
app.post('/api/check-availability', (req, res) => {
  const { date, time, durationMin, excludeId } = req.body;
  if (!date || !time) return res.json({ available: true });
  
  const newStart = timeToMin(time);
  const newEnd = newStart + Number(durationMin) + BUFFER_MIN;
  const dayRes = readRes().filter(r =>
    r.date === date && r.status !== 'cancelled' && r.id !== excludeId
  );
  
  for (const r of dayRes) {
    const rStart = timeToMin(r.time);
    const rEnd = rStart + Number(r.durationMin || 60) + BUFFER_MIN;
    if (newStart < rEnd && newEnd > rStart) {
      return res.json({
        available: false,
        conflict: { ref: r.ref, trajet: r.trajet, time: r.time }
      });
    }
  }
  
  res.json({ available: true });
});

/* ── API : RÉSERVATIONS ── */
app.post('/api/reservations', (req, res) => {
  const resData = { ...req.body, createdAt: new Date().toISOString() };
  const reservations = readRes();
  reservations.push(resData);
  writeRes(reservations);
  res.json({ success: true, ref: resData.ref });
});

app.get('/api/reservations', (req, res) => {
  const { pwd } = req.query;
  if (pwd !== ADMIN_PWD) return res.status(401).json({ error: 'Unauthorized' });
  res.json(readRes());
});

/* ── PAGES ── */
const pages = [
  'a-propos', 'faq', 'chauffeur-prive-versailles',
  'chauffeur-prive-neuilly-sur-seine', 'chauffeur-prive-boulogne-billancourt',
  'vtc-la-defense', 'vtc-vincennes', 'transfert-roissy-cdg', 'transfert-orly-paris'
];

pages.forEach(slug => {
  app.get(`/${slug}`, (req, res) => {
    res.sendFile(path.join(__dirname, 'vtc-project/public', `${slug}.html`));
  });
});

app.use(express.static(path.join(__dirname, 'vtc-project/public'), { extensions: ['html'] }));

// Pour Vercel, on exporte l'app au lieu d'écouter
module.exports = app;