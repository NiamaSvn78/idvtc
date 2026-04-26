const express = require('express');
const path    = require('path');
const fs      = require('fs');
const crypto  = require('crypto');
const nodemailer = require('nodemailer');

const app  = express();
const PORT = process.env.PORT || 3000;

/* ── STOCKAGE ── */
const DATA_DIR     = path.join(__dirname, 'data');
const RES_FILE     = path.join(DATA_DIR, 'reservations.json');
const DRIVERS_FILE = path.join(DATA_DIR, 'drivers.json');
if (!fs.existsSync(DATA_DIR))     fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(RES_FILE))     fs.writeFileSync(RES_FILE,     '[]');
if (!fs.existsSync(DRIVERS_FILE)) fs.writeFileSync(DRIVERS_FILE, '[]');

const ADMIN_PWD = process.env.ADMIN_PWD || 'idvtc2024';
const BUFFER_MIN = 0;

/* SMTP — configurer via variables d'environnement */
const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = Number(process.env.SMTP_PORT) || 587;
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;
const APP_URL   = (process.env.APP_URL || `http://localhost:${PORT}`).replace(/\/$/, '');

/* ── RÉSERVATIONS ── */
function readRes()      { try { return JSON.parse(fs.readFileSync(RES_FILE,     'utf8')); } catch { return []; } }
function writeRes(data) { fs.writeFileSync(RES_FILE,     JSON.stringify(data,    null, 2)); }
function readDrivers()  { try { return JSON.parse(fs.readFileSync(DRIVERS_FILE, 'utf8')); } catch { return []; } }
function writeDrivers(d){ fs.writeFileSync(DRIVERS_FILE, JSON.stringify(d,       null, 2)); }

function timeToMin(t) {
  const [h, m] = (t || '00:00').split(':').map(Number);
  return h * 60 + m;
}
function minToTime(m) {
  return String(Math.floor(m / 60)).padStart(2,'0') + ':' + String(m % 60).padStart(2,'0');
}
function fmtDateFr(iso) {
  if (!iso) return '—';
  const [y, mo, d] = iso.split('-');
  return `${d}/${mo}/${y}`;
}
function addMinToTime(time, min) {
  const total = timeToMin(time) + Number(min);
  return String(Math.floor(total / 60) % 24).padStart(2,'0') + ':' + String(total % 60).padStart(2,'0');
}
function missionToken(id) {
  return crypto.createHmac('sha256', ADMIN_PWD).update(id).digest('hex').slice(0, 20);
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
  const needed   = Number(durationMin) + BUFFER_MIN;
  const startMin = afterTime
    ? (() => {
        const req     = timeToMin(afterTime);
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

/* ── EMAIL CONDUCTEUR ── */
function buildDriverEmailHtml(r, driverName, missionUrl, driverPrice) {
  const dateStr = fmtDateFr(r.date);
  const endTime = addMinToTime(r.time, r.durationMin || 60);
  const dep = r.depLabel || (r.trajet || '').split(/[→>]/)[0]?.trim() || '—';
  const arr = r.arrLabel || (r.trajet || '').split(/[→>]/)[1]?.trim() || '—';
  const depEnc = encodeURIComponent(dep);
  const arrEnc = encodeURIComponent(arr);

  const calDate  = (r.date || '').replace(/-/g, '');
  const calStart = `${calDate}T${(r.time||'0000').replace(':','')}00`;
  const calEnd   = `${calDate}T${endTime.replace(':','')}00`;
  const calTitle = encodeURIComponent(`Course IsmaDrive — ${r.trajet||''}`);
  const calDesc  = encodeURIComponent(`Client: ${r.client||''}\nTél: ${r.tel||''}`);
  const calLoc   = encodeURIComponent(dep);
  const googleCal  = `https://www.google.com/calendar/render?action=TEMPLATE&text=${calTitle}&dates=${calStart}%2F${calEnd}&details=${calDesc}&location=${calLoc}`;
  const outlookCal = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${calTitle}&startdt=${r.date}T${r.time}:00&enddt=${r.date}T${endTime}:00&body=${calDesc}&location=${calLoc}`;

  const greeting = driverName ? `Bonjour ${driverName},` : 'Bonjour,';

  return `<!DOCTYPE html><html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;color:#333">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:24px 0">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:4px;overflow:hidden">
  <tr><td style="background:#080808;padding:24px 32px;border-bottom:2px solid #c9a96e">
    <div style="font-family:Georgia,serif;font-size:1.5rem;color:#c9a96e;letter-spacing:.1em">IsmaDrive</div>
    <div style="font-size:.7rem;color:#9a9185;letter-spacing:.2em;text-transform:uppercase;margin-top:3px">Espace conducteur</div>
  </td></tr>
  <tr><td style="padding:32px">
    <p style="margin:0 0 12px;font-size:1rem">${greeting}</p>
    <p style="margin:0 0 8px;font-size:1rem">Un nouveau trajet vous a été assigné pour le <strong>${dateStr} à ${r.time}</strong>.</p>
    <p style="margin:0 0 24px;font-size:.85rem;color:#666">
      Ajouter au calendrier :
      <a href="${googleCal}" style="color:#c9a96e;text-decoration:none">Google Agenda</a>
      &nbsp;—&nbsp;
      <a href="${outlookCal}" style="color:#c9a96e;text-decoration:none">Outlook</a>
    </p>
    <div style="background:#f9f6f0;border-left:3px solid #c9a96e;padding:14px 16px;margin-bottom:28px;font-size:.88rem;color:#555;line-height:1.5">
      Nous comptons sur votre ponctualité et votre professionnalisme pour assurer un service de transport de qualité à nos clients.
    </div>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px">
    <tr><td style="border-left:2px solid #c9a96e;padding:12px 16px;background:#fafafa">
      <div style="font-size:.68rem;color:#9a9185;text-transform:uppercase;letter-spacing:.14em;margin-bottom:4px">Départ</div>
      <div style="font-size:.95rem;font-weight:bold;color:#333;margin-bottom:6px">${dep}</div>
      <div style="font-size:.82rem">Naviguer :
        <a href="https://www.google.com/maps/dir/?api=1&destination=${depEnc}" style="color:#c9a96e;text-decoration:none">Google Maps</a>
        &nbsp;—&nbsp;
        <a href="https://waze.com/ul?q=${depEnc}&navigate=yes" style="color:#c9a96e;text-decoration:none">Waze</a>
      </div>
    </td></tr></table>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px">
    <tr><td style="border-left:2px solid #6e9ac9;padding:12px 16px;background:#fafafa">
      <div style="font-size:.68rem;color:#9a9185;text-transform:uppercase;letter-spacing:.14em;margin-bottom:4px">Destination</div>
      <div style="font-size:.95rem;font-weight:bold;color:#333;margin-bottom:6px">${arr}</div>
      <div style="font-size:.82rem">Naviguer :
        <a href="https://www.google.com/maps/dir/?api=1&destination=${arrEnc}" style="color:#c9a96e;text-decoration:none">Google Maps</a>
        &nbsp;—&nbsp;
        <a href="https://waze.com/ul?q=${arrEnc}&navigate=yes" style="color:#c9a96e;text-decoration:none">Waze</a>
      </div>
    </td></tr></table>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;border:1px solid #eee">
    <tr><td style="padding:14px 16px">
      <div style="font-size:.68rem;color:#9a9185;text-transform:uppercase;letter-spacing:.14em;margin-bottom:8px">Informations client</div>
      <div style="font-size:.92rem;margin-bottom:5px"><strong>Client :</strong> ${r.client || '—'}</div>
      <div style="font-size:.92rem"><strong>Téléphone :</strong> <a href="tel:${r.tel||''}" style="color:#c9a96e;text-decoration:none">${r.tel || '—'}</a></div>
      ${r.equipment ? `<div style="font-size:.82rem;color:#888;margin-top:5px">Équipement : ${r.equipment}</div>` : ''}
    </td></tr></table>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px">
    <tr><td style="background:#080808;border:1px solid #c9a96e;padding:14px 18px;border-radius:2px">
      <div style="font-size:.68rem;color:#9a9185;text-transform:uppercase;letter-spacing:.14em;margin-bottom:6px">Votre rémunération</div>
      <div style="font-family:Georgia,serif;font-size:1.8rem;color:#c9a96e;font-weight:bold;letter-spacing:.04em">${driverPrice} €</div>
      <div style="font-size:.75rem;color:#9a9185;margin-top:4px">Montant fixé pour cette course</div>
    </td></tr></table>
    <div style="background:#080808;border:1px solid #c9a96e;padding:18px 20px;margin-bottom:28px;border-radius:2px">
      <div style="font-size:.68rem;color:#9a9185;text-transform:uppercase;letter-spacing:.14em;margin-bottom:8px">Ordre de mission</div>
      <div style="font-size:.82rem;color:#f0ece4;margin-bottom:12px">Veuillez trouver l'ordre de mission avec les détails complets de la course :</div>
      <a href="${missionUrl}" style="display:inline-block;background:#c9a96e;color:#080808;padding:9px 22px;text-decoration:none;font-size:.8rem;font-weight:bold;letter-spacing:.1em;border-radius:2px">Voir l'ordre de mission →</a>
    </div>
    <p style="font-size:.85rem;color:#666;margin:0 0 12px">Si vous avez des questions supplémentaires ou besoin de plus d'informations, n'hésitez pas à nous contacter.</p>
    <p style="font-size:.85rem;color:#666;margin:0">Nous vous remercions pour votre collaboration.</p>
  </td></tr>
  <tr><td style="background:#f9f9f9;border-top:1px solid #eee;padding:14px 32px">
    <div style="font-size:.72rem;color:#aaa">IsmaDrive — Chauffeur Privé Paris &amp; Île-de-France &nbsp;·&nbsp; <a href="https://ismadrive.fr" style="color:#c9a96e;text-decoration:none">ismadrive.fr</a></div>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function buildMissionOrderHtml(r) {
  const dateStr = fmtDateFr(r.date);
  const dep = r.depLabel || (r.trajet || '').split(/[→>]/)[0]?.trim() || '—';
  const arr = r.arrLabel || (r.trajet || '').split(/[→>]/)[1]?.trim() || '—';
  const depEnc = encodeURIComponent(dep);
  const arrEnc = encodeURIComponent(arr);
  const qrData = encodeURIComponent(`IsmaDrive|Ref:${r.ref||r.id}|${r.trajet||''}|${dateStr}|${r.time||''}`);
  const statusLabel = r.status === 'done' ? 'Terminé' : r.status === 'cancelled' ? 'Annulé' : 'Confirmé';
  const statusColor = r.status === 'done' ? '#c9a96e' : r.status === 'cancelled' ? '#e05454' : '#27ae60';

  return `<!DOCTYPE html><html lang="fr">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ordre de mission ${r.ref||r.id} — IsmaDrive</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;background:#f4f4f4;color:#333;padding:20px;min-height:100vh}
.card{max-width:600px;margin:0 auto;background:#fff;border-radius:4px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.1)}
.card-head{background:#080808;padding:22px 28px;border-bottom:2px solid #c9a96e;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px}
.logo{font-family:Georgia,serif;font-size:1.5rem;color:#c9a96e;letter-spacing:.1em}
.ref-block{text-align:right}
.ref{font-size:.68rem;color:#9a9185;letter-spacing:.14em;text-transform:uppercase;margin-bottom:4px}
.badge{display:inline-block;padding:3px 10px;font-size:.68rem;text-transform:uppercase;letter-spacing:.1em;border-radius:2px}
.section{padding:18px 28px;border-bottom:1px solid #eee}
.lbl{font-size:.63rem;color:#9a9185;text-transform:uppercase;letter-spacing:.15em;margin-bottom:3px}
.val{font-size:.92rem;color:#333}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.nav-links{margin-top:7px;font-size:.8rem}
.nav-links a{color:#c9a96e;text-decoration:none;margin-right:14px}
.qr-block{padding:20px 28px;background:#fafafa;text-align:center}
@media(max-width:480px){.grid2{grid-template-columns:1fr}.card-head{flex-direction:column;align-items:flex-start}}
@media print{body{background:#fff;padding:0}.card{box-shadow:none}a{color:#333!important}}
</style>
</head>
<body>
<div class="card">
  <div class="card-head">
    <div class="logo">IsmaDrive</div>
    <div class="ref-block">
      <div class="ref">Réf. ${r.ref||r.id}</div>
      <span class="badge" style="background:${statusColor}22;color:${statusColor}">${statusLabel}</span>
    </div>
  </div>
  <div class="section">
    <div class="grid2">
      <div><div class="lbl">Date</div><div class="val">${dateStr}</div></div>
      <div><div class="lbl">Heure</div><div class="val">${r.time||'—'}</div></div>
      <div><div class="lbl">Durée estimée</div><div class="val">${r.durationMin||60} min</div></div>
      <div><div class="lbl">Véhicule</div><div class="val">${r.vehicleName||r.vehicle||'—'}</div></div>
    </div>
    ${r.equipment ? `<div style="margin-top:12px"><div class="lbl">Équipement</div><div class="val" style="font-size:.85rem">${r.equipment}</div></div>` : ''}
  </div>
  <div class="section" style="border-left:3px solid #c9a96e">
    <div class="lbl">Départ</div>
    <div class="val" style="font-weight:bold;font-size:1rem;margin:4px 0">${dep}</div>
    <div class="nav-links">
      <a href="https://www.google.com/maps/dir/?api=1&destination=${depEnc}" target="_blank">📍 Google Maps</a>
      <a href="https://waze.com/ul?q=${depEnc}&navigate=yes" target="_blank">🚗 Waze</a>
    </div>
  </div>
  <div class="section" style="border-left:3px solid #6e9ac9">
    <div class="lbl">Destination</div>
    <div class="val" style="font-weight:bold;font-size:1rem;margin:4px 0">${arr}</div>
    <div class="nav-links">
      <a href="https://www.google.com/maps/dir/?api=1&destination=${arrEnc}" target="_blank">📍 Google Maps</a>
      <a href="https://waze.com/ul?q=${arrEnc}&navigate=yes" target="_blank">🚗 Waze</a>
    </div>
  </div>
  <div class="section">
    <div class="grid2">
      <div><div class="lbl">Client</div><div class="val">${r.client||'—'}</div></div>
      <div><div class="lbl">Téléphone</div><div class="val"><a href="tel:${r.tel||''}" style="color:#c9a96e;text-decoration:none">${r.tel||'—'}</a></div></div>
    </div>
    ${r.notes ? `<div style="margin-top:12px"><div class="lbl">Notes</div><div class="val" style="font-size:.85rem;color:#555">${r.notes}</div></div>` : ''}
  </div>
  <div class="qr-block">
    <div style="font-size:.68rem;color:#bbb;margin-bottom:10px;text-transform:uppercase;letter-spacing:.12em">QR Code de validation</div>
    <img src="https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${qrData}" width="130" height="130" alt="QR code mission">
    <div style="font-size:.65rem;color:#ccc;margin-top:8px">Scanner pour valider la prise en charge</div>
  </div>
</div>
</body></html>`;
}

/* ── MIDDLEWARE ── */
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

/* ── API : DISPONIBILITÉ JOURNÉE ── */
app.get('/api/availability', (req, res) => {
  const { date } = req.query;
  if (!date) return res.json({ slots: [] });
  const dayRes = readRes().filter(r => r.date === date && r.status !== 'cancelled');
  const slots  = dayRes.map(r => ({
    startMin: timeToMin(r.time),
    endMin:   timeToMin(r.time) + Number(r.durationMin || 60) + BUFFER_MIN
  }));
  res.json({ date, slots });
});

/* ── API : SAUVEGARDER RÉSERVATION ── */
app.post('/api/reservations', (req, res) => {
  const { date, time, durationMin } = req.body;
  const conflict = checkConflict(date, time, durationMin || 60);
  if (conflict) return res.status(409).json({ error: 'Créneau indisponible', conflict });
  const id     = Date.now().toString(36).toUpperCase().slice(-8);
  const newRes = { ...req.body, id, createdAt: new Date().toISOString() };
  const all    = readRes();
  all.push(newRes);
  writeRes(all);
  res.json({ ok: true, id });
});

/* ── ADMIN : lire réservations ── */
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
  const id     = Date.now().toString(36).toUpperCase().slice(-8);
  const newRes = { ...data, id, status: 'confirmed', source: 'manual', createdAt: new Date().toISOString() };
  const all    = readRes();
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

/* ── CONDUCTEURS : lire ── */
app.get('/api/drivers', (req, res) => {
  if (req.query.pwd !== ADMIN_PWD) return res.status(401).json({ error: 'Non autorisé' });
  res.json(readDrivers());
});

/* ── CONDUCTEURS : ajouter ── */
app.post('/api/drivers', (req, res) => {
  const { pwd, name, phone, email, carCategory } = req.body;
  if (pwd !== ADMIN_PWD) return res.status(401).json({ error: 'Non autorisé' });
  if (!name || !email) return res.status(400).json({ error: 'Nom et email requis' });
  const drivers = readDrivers();
  if (!drivers.find(d => d.email === email)) {
    drivers.push({ id: Date.now().toString(36), name, phone: phone || '', email, carCategory: carCategory || '' });
    writeDrivers(drivers);
  }
  res.json({ ok: true });
});

/* ── CONDUCTEURS : modifier ── */
app.put('/api/drivers/:id', (req, res) => {
  const { pwd, name, phone, email, carCategory } = req.body;
  if (pwd !== ADMIN_PWD) return res.status(401).json({ error: 'Non autorisé' });
  if (!name || !email) return res.status(400).json({ error: 'Nom et email requis' });
  const drivers = readDrivers();
  const idx = drivers.findIndex(d => d.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Conducteur introuvable' });
  drivers[idx] = { ...drivers[idx], name, phone: phone || '', email, carCategory: carCategory || '' };
  writeDrivers(drivers);
  res.json({ ok: true });
});

/* ── CONDUCTEURS : supprimer ── */
app.delete('/api/drivers/:id', (req, res) => {
  const { pwd } = req.body;
  if (pwd !== ADMIN_PWD) return res.status(401).json({ error: 'Non autorisé' });
  writeDrivers(readDrivers().filter(d => d.id !== req.params.id));
  res.json({ ok: true });
});

/* ── ENVOI EMAIL CONDUCTEUR ── */
app.post('/api/send-driver-email', async (req, res) => {
  const { pwd, tripId, driverEmail, driverName, driverPrice } = req.body;
  if (pwd !== ADMIN_PWD) return res.status(401).json({ error: 'Non autorisé' });
  if (!SMTP_HOST) return res.status(503).json({
    error: 'SMTP non configuré. Ajoutez SMTP_HOST, SMTP_USER et SMTP_PASS dans vos variables d\'environnement.'
  });
  const r = readRes().find(x => x.id === tripId);
  if (!r) return res.status(404).json({ error: 'Course introuvable' });

  const token      = missionToken(tripId);
  const missionUrl = `${APP_URL}/mission-order/${tripId}?token=${token}`;
  const html       = buildDriverEmailHtml(r, driverName || '', missionUrl, driverPrice);

  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST, port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS }
    });
    await transporter.sendMail({
      from:    `IsmaDrive <${SMTP_FROM || SMTP_USER}>`,
      to:      driverEmail,
      subject: `Course IsmaDrive — ${fmtDateFr(r.date)} à ${r.time}`,
      html
    });
    /* Sauvegarde automatique du conducteur si nouveau */
    const drivers = readDrivers();
    if (driverName && !drivers.find(d => d.email === driverEmail)) {
      drivers.push({ id: Date.now().toString(36), name: driverName, email: driverEmail });
      writeDrivers(drivers);
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Erreur envoi : ' + e.message });
  }
});

/* ── ORDRE DE MISSION ── */
app.get('/mission-order/:id', (req, res) => {
  const r = readRes().find(x => x.id === req.params.id);
  if (!r) return res.status(404).send('Course introuvable');
  const expected = missionToken(req.params.id);
  if (req.query.token !== expected && req.query.pwd !== ADMIN_PWD)
    return res.status(403).send('Accès refusé');
  res.send(buildMissionOrderHtml(r));
});

/* ── PAGES ── */
app.get('/admin', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

const pages = [
  'a-propos','faq','chauffeur-prive-versailles','chauffeur-prive-neuilly-sur-seine',
  'chauffeur-prive-boulogne-billancourt','vtc-la-defense','vtc-vincennes',
  'transfert-roissy-cdg','transfert-orly-paris',
];
pages.forEach(slug => {
  app.get(`/${slug}`, (_req, res) => res.sendFile(path.join(__dirname, 'public', `${slug}.html`)));
});

app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

app.listen(PORT, () => {
  console.log(`\n✅ Serveur démarré : http://localhost:${PORT}`);
  console.log(`   Admin            : http://localhost:${PORT}/admin`);
  console.log(`   SMTP configuré   : ${SMTP_HOST ? '✅ ' + SMTP_HOST : '❌ non configuré (SMTP_HOST manquant)'}\n`);
});
