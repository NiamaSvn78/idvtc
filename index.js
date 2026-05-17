if (process.env.NODE_ENV !== 'production') {
  try { require('dotenv').config({ path: '.env.local' }); } catch {}
  try { require('dotenv').config({ path: 'vtc-project/.env.local' }); } catch {}
}
const express = require('express');
const path = require('path');
const QRCode = require('qrcode');
const { Resend } = require('resend');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const port = process.env.PORT || 3000;

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const RESEND_FROM = process.env.RESEND_FROM_EMAIL || '';
const RESEND_BCC_EMAIL = String(process.env.RESEND_BCC_EMAIL || '').trim();
const ADMIN_PAYMENT_NOTIFY_EMAIL = String(
  process.env.ADMIN_PAYMENT_NOTIFY_EMAIL || 'diabyismaila80@gmail.com'
).trim();
const APP_URL = (process.env.APP_URL || 'https://ismadrive.fr').replace(/\/$/, '');
const PUBLIC_SITE_URL = APP_URL;
const WHATSAPP_BOOKING_URL = 'https://wa.me/33623889717';
const GOOGLE_REVIEWS_URL = String(process.env.GOOGLE_REVIEWS_URL || 'https://g.page/r/CWL4dJY-hj2oEAE/review').trim();
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const ADMIN_PWD = process.env.ADMIN_PWD || '';

if (!ADMIN_PWD) {
  console.error('[SECURITE] ADMIN_PWD manquant — toutes les routes admin seront bloquées. Configurez ADMIN_PWD dans vos variables d\'environnement.');
}

const supabase = SUPABASE_URL && SUPABASE_SERVICE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  : null;

const stripe = STRIPE_SECRET_KEY ? require('stripe')(STRIPE_SECRET_KEY) : null;

const { createClientConfirmationMailer } = require('./lib/client-confirmation-email');
const clientConfirmationMail = createClientConfirmationMailer({
  appUrl: APP_URL,
  from: RESEND_FROM,
  bccEmail: RESEND_BCC_EMAIL,
  resendSend: async (payload) => {
    if (!RESEND_API_KEY || !RESEND_FROM) {
      return { data: null, error: { message: 'RESEND_API_KEY ou RESEND_FROM_EMAIL manquant' } };
    }
    const resend = new Resend(RESEND_API_KEY);
    return resend.emails.send(payload);
  },
  markSent: (id) => dbUpdate(id, { confirmationEmailSent: true }),
  persistEmail: (id, email) => dbUpdate(id, { email }),
});
const sendClientConfirmationAfterPayment = clientConfirmationMail.sendAfterPayment;

/* ── DB helpers (fallback mémoire si Supabase absent) ── */
let _mem = [];

async function dbInsert(r) {
  if (supabase) {
    const { error } = await supabase.from('reservations').insert(r);
    if (error) throw new Error(error.message);
  } else {
    _mem.push(r);
  }
}

async function dbList() {
  if (supabase) {
    const { data, error } = await supabase
      .from('reservations').select('*').order('createdAt', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  }
  return _mem;
}

async function dbGetById(id) {
  if (supabase) {
    const { data } = await supabase.from('reservations').select('*').eq('id', id).single();
    return data || null;
  }
  return _mem.find(r => r.id === id) || null;
}

async function dbUpdate(id, updates) {
  if (supabase) {
    const { error } = await supabase
      .from('reservations').update(updates).eq('id', id);
    if (error) throw new Error(error.message);
    return { id, ...updates };
  }
  const idx = _mem.findIndex(r => r.id === id);
  if (idx === -1) return null;
  _mem[idx] = { ..._mem[idx], ...updates };
  return _mem[idx];
}

/* ── DB helpers conducteurs ── */
let _drivers = [];

async function dbListDrivers() {
  if (supabase) {
    const { data } = await supabase.from('drivers').select('*').order('createdAt', { ascending: false });
    return data || [];
  }
  return _drivers;
}

async function dbInsertDriver(d) {
  if (supabase) {
    const { error } = await supabase.from('drivers').upsert(d, { onConflict: 'email', ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  } else {
    const idx = _drivers.findIndex(x => x.email === d.email);
    if (idx === -1) _drivers.push(d);
  }
}

async function dbUpdateDriver(id, updates) {
  if (supabase) {
    const { error } = await supabase.from('drivers').update(updates).eq('id', id);
    if (error) throw new Error(error.message);
  } else {
    const idx = _drivers.findIndex(x => x.id === id);
    if (idx !== -1) _drivers[idx] = { ..._drivers[idx], ...updates };
  }
}

async function dbDeleteDriver(id) {
  if (supabase) {
    const { error } = await supabase.from('drivers').delete().eq('id', id);
    if (error) throw new Error(error.message);
  } else {
    _drivers = _drivers.filter(x => x.id !== id);
  }
}

/* ── Helpers disponibilité ── */
function timeToMin(t) {
  const [h, m] = (t || '00:00').split(':').map(Number);
  return h * 60 + m;
}

async function dbListByDate(date) {
  if (!supabase) return _mem.filter(r => r.date === date && r.status !== 'cancelled');
  const { data } = await supabase.from('reservations').select('*')
    .eq('date', date).neq('status', 'cancelled');
  return data || [];
}

async function checkConflict(date, time, durationMin, excludeId = null) {
  const newStart = timeToMin(time);
  const newEnd = newStart + Number(durationMin);
  const dayRes = (await dbListByDate(date)).filter(r => r.id !== excludeId);
  for (const r of dayRes) {
    const rStart = timeToMin(r.time);
    const rEnd = rStart + Number(r.durationMin || 60);
    if (newStart < rEnd && newEnd > rStart) return r;
  }
  return null;
}

function fmtDateFr(iso) {
  if (!iso) return '—';
  const [y, mo, d] = iso.split('-');
  return `${d}/${mo}/${y}`;
}

function addMinToTime(time, min) {
  const total = timeToMin(time) + Number(min);
  return String(Math.floor(total / 60) % 24).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0');
}

function missionToken(id) {
  return crypto.createHmac('sha256', ADMIN_PWD).update(id).digest('hex').slice(0, 20);
}

function buildDriverEmailHtml(r, driverName, missionUrl, driverPrice, driverPlate, driverEmailTo) {
  const dn = String(driverName || '').trim();
  const dp = String(driverPlate || '').trim();
  const dem = String(driverEmailTo || '').trim();
  const dateStr = fmtDateFr(r.date);
  const endTime = addMinToTime(r.time, r.durationMin || 60);
  const dep = r.depLabel || (r.trajet || '').split(/[→>]/)[0]?.trim() || '—';
  const arr = r.arrLabel || (r.trajet || '').split(/[→>]/)[1]?.trim() || '—';
  const depEnc = encodeURIComponent(dep);
  const arrEnc = encodeURIComponent(arr);
  const calDate = (r.date || '').replace(/-/g, '');
  const calStart = `${calDate}T${(r.time || '0000').replace(':', '')}00`;
  const calEnd = `${calDate}T${endTime.replace(':', '')}00`;
  const calTitle = encodeURIComponent(`Course IsmaDrive — ${r.trajet || ''}`);
  const calDesc = encodeURIComponent(`Client: ${r.client || ''}\nTél: ${r.tel || ''}\nConducteur: ${dn || '—'}${dp ? ' · ' + dp : ''}`);
  const calLoc = encodeURIComponent(dep);
  const googleCal = `https://www.google.com/calendar/render?action=TEMPLATE&text=${calTitle}&dates=${calStart}%2F${calEnd}&details=${calDesc}&location=${calLoc}`;
  const outlookCal = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${calTitle}&startdt=${r.date}T${r.time}:00&enddt=${r.date}T${endTime}:00&body=${calDesc}&location=${calLoc}`;
  const dnEsc = escHtml(dn);
  const dpEsc = escHtml(dp);
  const demEsc = escHtml(dem);
  const greeting = dn ? `Bonjour ${dnEsc},` : 'Bonjour,';

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
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
    ${dem ? `<p style="margin:0 0 10px;font-size:.82rem;color:#666">Ce message est destiné à <strong>${demEsc}</strong> — merci de vérifier qu'il s'agit bien de vous.</p>` : ''}
    <p style="margin:0 0 24px;font-size:.85rem;color:#666">Ajouter au calendrier :
      <a href="${googleCal}" style="color:#c9a96e;text-decoration:none">Google Agenda</a> &nbsp;—&nbsp;
      <a href="${outlookCal}" style="color:#c9a96e;text-decoration:none">Outlook</a>
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;border:1px solid #e8e0d0">
    <tr><td style="padding:14px 16px;background:#fffbf2">
      <div style="font-size:.68rem;color:#9a9185;text-transform:uppercase;letter-spacing:.14em;margin-bottom:6px">Vous (conducteur assigné)</div>
      <div style="font-size:1.05rem;font-weight:bold;color:#080808">${dnEsc || '<span style="color:#888;font-weight:500">—</span>'}</div>
      ${dp ? `<div style="font-size:.88rem;margin-top:8px;color:#333"><strong>Immatriculation :</strong> <span style="font-family:monospace;letter-spacing:.08em">${dpEsc}</span></div>` : '<div style="font-size:.82rem;margin-top:6px;color:#888">Immatriculation non renseignée</div>'}
    </td></tr></table>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px">
    <tr><td style="border-left:2px solid #c9a96e;padding:12px 16px;background:#fafafa">
      <div style="font-size:.68rem;color:#9a9185;text-transform:uppercase;letter-spacing:.14em;margin-bottom:4px">Départ</div>
      <div style="font-size:.95rem;font-weight:bold;color:#333;margin-bottom:6px">${dep}</div>
      <div style="font-size:.82rem">Naviguer :
        <a href="https://www.google.com/maps/dir/?api=1&destination=${depEnc}" style="color:#c9a96e;text-decoration:none">Google Maps</a> &nbsp;—&nbsp;
        <a href="https://waze.com/ul?q=${depEnc}&navigate=yes" style="color:#c9a96e;text-decoration:none">Waze</a>
      </div>
    </td></tr></table>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px">
    <tr><td style="border-left:2px solid #6e9ac9;padding:12px 16px;background:#fafafa">
      <div style="font-size:.68rem;color:#9a9185;text-transform:uppercase;letter-spacing:.14em;margin-bottom:4px">Destination</div>
      <div style="font-size:.95rem;font-weight:bold;color:#333;margin-bottom:6px">${arr}</div>
      <div style="font-size:.82rem">Naviguer :
        <a href="https://www.google.com/maps/dir/?api=1&destination=${arrEnc}" style="color:#c9a96e;text-decoration:none">Google Maps</a> &nbsp;—&nbsp;
        <a href="https://waze.com/ul?q=${arrEnc}&navigate=yes" style="color:#c9a96e;text-decoration:none">Waze</a>
      </div>
    </td></tr></table>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;border:1px solid #eee">
    <tr><td style="padding:14px 16px">
      <div style="font-size:.68rem;color:#9a9185;text-transform:uppercase;letter-spacing:.14em;margin-bottom:8px">Informations client</div>
      <div style="font-size:.92rem;margin-bottom:5px"><strong>Client :</strong> ${escHtml(r.client || '—')}</div>
      <div style="font-size:.92rem"><strong>Téléphone :</strong> <a href="tel:${r.tel || ''}" style="color:#c9a96e;text-decoration:none">${escHtml(r.tel || '—')}</a></div>
      ${r.equipment ? `<div style="font-size:.82rem;color:#888;margin-top:5px">Équipement : ${escHtml(r.equipment)}</div>` : ''}
    </td></tr></table>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px">
    <tr><td style="background:#080808;border:1px solid #c9a96e;padding:14px 18px;border-radius:2px">
      <div style="font-size:.68rem;color:#9a9185;text-transform:uppercase;letter-spacing:.14em;margin-bottom:6px">Votre rémunération</div>
      <div style="font-family:Georgia,serif;font-size:1.8rem;color:#c9a96e;font-weight:bold;letter-spacing:.04em">${driverPrice} €</div>
      <div style="font-size:.75rem;color:#9a9185;margin-top:4px">Montant fixé pour cette course</div>
    </td></tr></table>
    <div style="background:#080808;border:1px solid #c9a96e;padding:18px 20px;margin-bottom:28px;border-radius:2px;text-align:center">
      <div style="font-size:.68rem;color:#9a9185;text-transform:uppercase;letter-spacing:.14em;margin-bottom:8px">Ordre de mission</div>
      <div style="font-size:.82rem;color:#f0ece4;margin-bottom:16px">Cliquez pour accéder à votre bon de commande :</div>
      <a href="${missionUrl}" style="display:inline-block;background:#c9a96e;color:#080808;padding:9px 22px;text-decoration:none;font-size:.8rem;font-weight:bold;letter-spacing:.1em;border-radius:2px">Voir l'ordre de mission →</a>
    </div>
    <p style="font-size:.85rem;color:#666;margin:0 0 12px">Si vous avez des questions, n'hésitez pas à nous contacter.</p>
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
  const qrData = encodeURIComponent(`IsmaDrive|Ref:${r.ref || r.id}|${r.trajet || ''}|${dateStr}|${r.time || ''}`);
  const statusLabel = r.status === 'done' ? 'Terminé' : r.status === 'cancelled' ? 'Annulé' : 'Confirmé';
  const statusColor = r.status === 'done' ? '#c9a96e' : r.status === 'cancelled' ? '#e05454' : '#27ae60';
  const driverNameRaw = String(r.assignedDriverName || '').trim();
  const plateRaw = String(r.assignedDriverPlate || '').trim();
  const driverNameHtml = driverNameRaw ? escHtml(driverNameRaw) : '—';
  const plateCell = plateRaw
    ? `<div><div class="lbl">Immatriculation</div><div class="val" style="font-size:1.05rem;font-weight:bold;color:#080808;letter-spacing:.08em;font-family:monospace">${escHtml(plateRaw)}</div></div>`
    : `<div><div class="lbl">Immatriculation</div><div class="val" style="color:#888">—</div></div>`;

  return `<!DOCTYPE html><html lang="fr">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ordre de mission ${r.ref || r.id} — IsmaDrive</title>
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
      <div class="ref">Réf. ${r.ref || r.id}</div>
      <span class="badge" style="background:${statusColor}22;color:${statusColor}">${statusLabel}</span>
    </div>
  </div>
  <div class="section">
    <div class="grid2">
      <div><div class="lbl">Date</div><div class="val">${dateStr}</div></div>
      <div><div class="lbl">Heure</div><div class="val">${r.time || '—'}</div></div>
      <div><div class="lbl">Durée estimée</div><div class="val">${r.durationMin || 60} min</div></div>
      <div><div class="lbl">Véhicule</div><div class="val">${r.vehicleName || r.vehicle || '—'}</div></div>
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
      <div><div class="lbl">Client</div><div class="val">${r.client || '—'}</div></div>
      <div><div class="lbl">Téléphone</div><div class="val"><a href="tel:${r.tel || ''}" style="color:#c9a96e;text-decoration:none">${r.tel || '—'}</a></div></div>
    </div>
    ${r.notes ? `<div style="margin-top:12px"><div class="lbl">Notes</div><div class="val" style="font-size:.85rem;color:#555">${r.notes}</div></div>` : ''}
  </div>
  <div class="section" style="background:#fffbf2;border-left:3px solid #c9a96e">
    <div style="font-size:.63rem;color:#9a9185;text-transform:uppercase;letter-spacing:.15em;margin-bottom:10px">Conducteur assigné (bon)</div>
    <div class="grid2">
      <div><div class="lbl">Nom</div><div class="val" style="font-size:1.15rem;font-weight:bold;color:#080808">${driverNameHtml}</div></div>
      ${plateCell}
    </div>
    ${r.driverOrderSentTo ? `<div style="margin-top:12px;font-size:.78rem;color:#777;line-height:1.45">Bon transmis à <strong style="color:#555">${escHtml(r.driverOrderSentTo)}</strong>.</div>` : ''}
  </div>
  <div class="qr-block">
    <div style="font-size:.68rem;color:#bbb;margin-bottom:10px;text-transform:uppercase;letter-spacing:.12em">QR Code de validation</div>
    <img src="https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${qrData}" width="130" height="130" alt="QR code mission">
  </div>
</div>
</body></html>`;
}

/* ── Telegram + email admin : paiement confirmé (même corps de message) ── */
function tgPlain(s, maxLen) {
  return String(s == null ? '' : s)
    .replace(/\r?\n/g, ' ')
    .slice(0, maxLen || 200);
}

function buildAdminPaymentNotifyPlainText(r, sourceTag) {
  const ref = tgPlain(r.ref || r.id, 48);
  const price = r.price != null && r.price !== '' ? String(r.price) : '—';
  const lines = [
    '✅ Paiement reçu — IsmaDrive',
    '',
    'Réf: ' + ref,
    'Montant: ' + price + ' €',
    'Client: ' + tgPlain(r.client, 80),
    'Trajet: ' + tgPlain(r.trajet, 150),
    'Quand: ' + tgPlain(r.date, 14) + ' · ' + tgPlain(r.time, 8),
    'Véhicule: ' + tgPlain(r.vehicleName || r.vehicle, 40),
  ];
  const tel = String(r.tel || '').trim();
  if (tel) lines.push('Tél: ' + tgPlain(tel, 24));
  lines.push('', '(' + String(sourceTag || '—') + ')');

  let text = lines.join('\n');
  if (text.length > 3900) text = text.slice(0, 3890) + '…';
  return text;
}

async function notifyAdminTelegramPayment(r, sourceTag) {
  const token = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const chatId = String(process.env.TELEGRAM_ADMIN_CHAT_ID || '').trim();
  if (!token || !chatId) return;

  const text = buildAdminPaymentNotifyPlainText(r, sourceTag);

  const url = 'https://api.telegram.org/bot' + token + '/sendMessage';
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 12000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
      signal: ac.signal,
    });
    const raw = await res.text();
    if (!res.ok) {
      console.error('[Telegram] sendMessage HTTP', res.status, raw.slice(0, 500));
    }
  } catch (e) {
    console.error('[Telegram] sendMessage:', e.message || e);
  } finally {
    clearTimeout(t);
  }
}

/* ── Stripe webhook — doit être AVANT express.json() ── */
app.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe || !STRIPE_WEBHOOK_SECRET) return res.status(500).json({ error: 'Stripe non configuré' });
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature invalide:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const reservationId = session.metadata?.reservationId;
    if (reservationId) {
      const before = await dbGetById(reservationId).catch(() => null);
      const alreadyPaidThisSession =
        before &&
        before.paymentStatus === 'paid' &&
        before.stripeSessionId === session.id;
      await dbUpdate(reservationId, {
        status: 'confirmed',
        paymentStatus: 'paid',
        stripeSessionId: session.id,
        paidAt: new Date().toISOString()
      }).catch(e => console.error('DB update webhook error:', e.message));
      const r = await dbGetById(reservationId).catch(() => null);
      console.log('[Stripe] Paiement confirmé réservation', reservationId);
      if (r) {
        if (!alreadyPaidThisSession) {
          await notifyAdminTelegramPayment(r, 'stripe_webhook').catch(e =>
            console.error('[Telegram] admin notify:', e.message)
          );
          await notifyAdminEmailPayment(r, 'stripe_webhook').catch(e =>
            console.error('[Resend] admin paiement notify:', e.message)
          );
        }
        await sendClientConfirmationAfterPayment(r, session.customer_email).catch(e =>
          console.error('[Resend] confirmation client:', e.message)
        );
      }
    }
  }
  res.json({ received: true });
});

/* ── Middleware ── */
app.use(helmet({
  contentSecurityPolicy: false, // désactivé car on sert des HTML inline complexes
}));
app.use(express.json({ limit: '100kb' }));

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 30,
  message: { error: 'Trop de tentatives, réessayez dans 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const publicLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 20,
  message: { error: 'Trop de requêtes, réessayez dans une minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function notifyAdminEmailPayment(r, sourceTag) {
  const to = ADMIN_PAYMENT_NOTIFY_EMAIL;
  if (!to || !RESEND_API_KEY || !RESEND_FROM) return;

  const plain = buildAdminPaymentNotifyPlainText(r, sourceTag);
  const refShort = tgPlain(r.ref || r.id, 48);
  const subject = `✅ Paiement reçu — IsmaDrive · ${refShort}`;
  const safe = escHtml(plain);
  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"></head>
<body style="margin:0;background:#f4f4f4;font-family:Arial,sans-serif;color:#333">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:4px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)">
<tr><td style="padding:20px 26px;border-bottom:2px solid #c9a96e;background:#080808">
  <div style="font-family:Georgia,serif;font-size:1.25rem;color:#c9a96e;letter-spacing:.08em">IsmaDrive</div>
  <div style="font-size:.62rem;color:#9a9185;letter-spacing:.18em;text-transform:uppercase;margin-top:4px">Notification admin · Paiement reçu</div>
</td></tr>
<tr><td style="padding:22px 26px"><pre style="margin:0;white-space:pre-wrap;font-family:Consolas,Monaco,monospace;font-size:13px;line-height:1.55;color:#222">${safe}</pre></td></tr>
</table></td></tr></table></body></html>`;

  try {
    const resend = new Resend(RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: RESEND_FROM,
      to,
      subject,
      html,
      text: plain,
    });
    if (error) console.error('[Resend] admin paiement:', error.message || error);
  } catch (e) {
    console.error('[Resend] admin paiement:', e.message || e);
  }
}

/** Même contenu que le QR généré côté client (index.html → generateQR) */
function buildQrPayload(r) {
  const nom = String(r.client || '').substring(0, 22);
  const dateStr = (r.date || '').split('-').reverse().join('/');
  const equip = r.equipment && String(r.equipment).trim()
    ? String(r.equipment).replace(/\s*\+\s*/g, '+')
    : 'Non';
  return [
    'IsmaDrive - PAIEMENT NON EFFECTUE',
    'Ref:' + String(r.ref || ''),
    'Trajet:' + String(r.trajet || ''),
    'Vehicule:' + String(r.vehicleName || ''),
    'Date:' + dateStr + ' ' + String(r.time || ''),
    'Client:' + nom,
    'Equip:' + equip,
    'Prix:' + String(r.price != null ? r.price : 0) + 'EUR',
    'Paiement:Non',
    'Mode:' + String(r.paymentMethod || '')
  ].join('|');
}

/** PNG encodé en data URL — affiché même si le client mail bloque les images externes */
async function qrPayloadToDataUrl(payloadText) {
  return QRCode.toDataURL(payloadText, {
    width: 280,
    margin: 1,
    errorCorrectionLevel: 'M',
    type: 'image/png',
    color: { dark: '#000000', light: '#ffffff' }
  });
}

function buildConfirmationEmailHtml(r, qrDataUrl) {
  const rows = [
    ['Référence', r.ref],
    ['Client', r.client],
    ['Téléphone', r.tel],
    ['Trajet', r.trajet],
    ['Date et heure', `${r.date || ''} à ${r.time || ''}`],
    ['Véhicule', r.vehicleName],
    ['Montant estimé', `${r.price != null ? r.price : '—'} €`],
    ['Statut paiement', 'À régler (non encaissé en ligne pour l’instant)'],
    ['Mode de paiement souhaité', r.paymentMethod || '—']
  ];
  if (r.equipment) rows.splice(-2, 0, ['Équipement', r.equipment]);
  if (r.notes) rows.push(['Vos précisions', r.notes]);

  const tableRows = rows.map(([k, v]) =>
    `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#888;font-size:13px">${escHtml(k)}</td>` +
    `<td style="padding:8px 12px;border-bottom:1px solid #eee;color:#111;font-size:14px">${escHtml(v)}</td></tr>`
  ).join('');

  const site = escHtml(PUBLIC_SITE_URL);

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"></head>
<body style="margin:0;background:#f4f4f4;font-family:Arial,sans-serif;color:#333">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:4px;overflow:hidden;border:1px solid #e8e8e8">
<tr><td style="background:#080808;padding:22px 28px;border-bottom:2px solid #c9a96e">
<div style="font-family:Georgia,serif;font-size:1.45rem;color:#c9a96e;letter-spacing:.08em">IsmaDrive</div>
<div style="font-size:.72rem;color:#9a9185;letter-spacing:.18em;text-transform:uppercase;margin-top:4px">Votre réservation est enregistrée</div>
</td></tr>
<tr><td style="padding:28px 28px 12px">
<p style="margin:0 0 14px;font-size:15px;line-height:1.6">Bonjour ${escHtml(r.client)},</p>
<p style="margin:0 0 14px;font-size:14px;line-height:1.65;color:#444">Merci pour votre confiance. Votre demande de transfert privé est <strong>bien enregistrée</strong> sous la référence indiquée ci-dessous.</p>
<p style="margin:0 0 20px;font-size:14px;line-height:1.65;color:#555">Votre <strong>QR code</strong> figure ci-dessous — présentez-le au chauffeur au départ.</p>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px">${tableRows}</table>
<div style="text-align:center;padding:16px 0 8px">
<img src="${qrDataUrl}" width="280" height="280" alt="QR code réservation IsmaDrive" style="display:inline-block;border:1px solid #ddd;border-radius:4px"/>
<p style="margin:12px 0 0;font-size:12px;color:#888">Réf. ${escHtml(r.ref)} · Paiement à finaliser</p>
</div>
<p style="margin:22px 0 0;font-size:13px;line-height:1.65;color:#555">Une question ou un changement d’horaire ? Répondez à cet email, écrivez-nous à <a href="mailto:contact@ismadrive.fr" style="color:#8a7348">contact@ismadrive.fr</a> ou sur <a href="${WHATSAPP_BOOKING_URL}" style="color:#8a7348">WhatsApp (+33 6 23 88 97 17)</a>.</p>
<p style="margin:18px 0 0;font-size:12px;line-height:1.5;color:#999">À très bientôt,<br/>L’équipe IsmaDrive</p>
</td></tr>
<tr><td style="background:#fafafa;border-top:1px solid #eee;padding:14px 28px;text-align:center">
<div style="font-size:11px;color:#aaa">© IsmaDrive · <a href="${site}" style="color:#c9a96e;text-decoration:none">ismadrive.fr</a></div>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function buildReviewEmailHtml(r, qrDataUrl) {
  const client = escHtml(r.client || 'cher client');
  const ref = escHtml(r.ref || r.id || '');
  const site = escHtml(PUBLIC_SITE_URL);
  const reviewUrl = escHtml(GOOGLE_REVIEWS_URL);

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"></head>
<body style="margin:0;background:#f4f4f4;font-family:Arial,sans-serif;color:#333">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:4px;overflow:hidden;border:1px solid #e8e8e8">
<tr><td style="background:#080808;padding:22px 28px;border-bottom:2px solid #c9a96e">
  <div style="font-family:Georgia,serif;font-size:1.45rem;color:#c9a96e;letter-spacing:.08em">IsmaDrive</div>
  <div style="font-size:.72rem;color:#9a9185;letter-spacing:.18em;text-transform:uppercase;margin-top:4px">Merci pour votre confiance</div>
</td></tr>
<tr><td style="padding:28px 28px 20px">
  <p style="margin:0 0 14px;font-size:15px;line-height:1.6">Bonjour ${client},</p>
  <p style="margin:0 0 14px;font-size:14px;line-height:1.65;color:#444">Merci d'avoir voyagé avec IsmaDrive. Nous espérons que votre trajet s'est déroulé dans les meilleures conditions.</p>
  <p style="margin:0 0 20px;font-size:14px;line-height:1.65;color:#555">Votre avis sur Google nous aide à aider d'autres voyageurs à nous trouver. Cela ne prend que 30 secondes.</p>
  <div style="text-align:center;padding:24px 0 16px;border:1px solid #f0ece4;border-radius:4px;background:#fffbf5;margin-bottom:20px">
    <img src="${qrDataUrl}" width="180" height="180" alt="QR code avis Google IsmaDrive" style="display:inline-block;border:1px solid #e8e0d0;border-radius:4px"/>
    <p style="margin:12px 0 4px;font-size:11px;color:#bbb;letter-spacing:.1em;text-transform:uppercase">Scanner pour laisser un avis</p>
    <a href="${reviewUrl}" style="display:inline-block;margin-top:14px;background:#080808;color:#c9a96e;padding:11px 28px;text-decoration:none;font-size:13px;font-weight:500;letter-spacing:.1em;text-transform:uppercase;border:1px solid #c9a96e;border-radius:2px">Laisser un avis Google →</a>
  </div>
  <p style="margin:16px 0 0;font-size:13px;line-height:1.65;color:#555">Une question ? Répondez à cet email ou contactez-nous sur <a href="${escHtml(WHATSAPP_BOOKING_URL)}" style="color:#8a7348">WhatsApp (+33 6 23 88 97 17)</a>.</p>
  <p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#999">À très bientôt,<br/>L'équipe IsmaDrive</p>
</td></tr>
<tr><td style="background:#fafafa;border-top:1px solid #eee;padding:14px 28px;text-align:center">
  <div style="font-size:11px;color:#aaa">Réf. ${ref} · © IsmaDrive · <a href="${site}" style="color:#c9a96e;text-decoration:none">ismadrive.fr</a></div>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

/* ── API ── */

/* Réservation manuelle (admin) — doit être AVANT /api/reservations/:id */
app.post('/api/reservations/manual', adminLimiter, async (req, res) => {
  const { pwd, ...data } = req.body || {};
  if (pwd !== ADMIN_PWD) return res.status(401).json({ error: 'Non autorisé' });
  const conflict = await checkConflict(data.date, data.time, data.durationMin || 60);
  if (conflict) return res.status(409).json({ error: 'Créneau indisponible', conflict });
  const id = Date.now().toString(36).toUpperCase().slice(-8);
  const ref = `RES-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${id.slice(-4)}`;
  const newRes = { ...data, id, ref, status: 'confirmed', source: 'manual', createdAt: new Date().toISOString() };
  await dbInsert(newRes);
  res.json({ ok: true, id, ref });
});

/* Conducteurs */
app.get('/api/drivers', adminLimiter, async (req, res) => {
  if (req.query.pwd !== ADMIN_PWD) return res.status(401).json({ error: 'Non autorisé' });
  try { res.json(await dbListDrivers()); } catch (e) { res.status(500).json({ error: 'Erreur serveur' }); }
});

app.post('/api/drivers', adminLimiter, async (req, res) => {
  const { pwd, name, phone, email, carCategory, immatriculation } = req.body || {};
  if (pwd !== ADMIN_PWD) return res.status(401).json({ error: 'Non autorisé' });
  if (!name || !email) return res.status(400).json({ error: 'Nom et email requis' });
  await dbInsertDriver({ id: Date.now().toString(36), name, phone: phone || '', email, carCategory: carCategory || '', immatriculation: immatriculation || '', createdAt: new Date().toISOString() });
  res.json({ ok: true });
});

app.put('/api/drivers/:id', adminLimiter, async (req, res) => {
  const { pwd, name, phone, email, carCategory, immatriculation } = req.body || {};
  if (pwd !== ADMIN_PWD) return res.status(401).json({ error: 'Non autorisé' });
  if (!name || !email) return res.status(400).json({ error: 'Nom et email requis' });
  await dbUpdateDriver(req.params.id, { name, phone: phone || '', email, carCategory: carCategory || '', immatriculation: immatriculation || '' });
  res.json({ ok: true });
});

app.delete('/api/drivers/:id', adminLimiter, async (req, res) => {
  const { pwd } = req.body || {};
  if (pwd !== ADMIN_PWD) return res.status(401).json({ error: 'Non autorisé' });
  await dbDeleteDriver(req.params.id);
  res.json({ ok: true });
});

/* Email conducteur */
app.post('/api/send-driver-email', adminLimiter, async (req, res) => {
  const { pwd, tripId, driverEmail, driverName, driverPrice, driverPlate } = req.body || {};
  if (pwd !== ADMIN_PWD) return res.status(401).json({ error: 'Non autorisé' });
  if (!RESEND_API_KEY) return res.status(503).json({ error: 'RESEND_API_KEY manquant.' });
  const to = String(driverEmail || '').trim();
  if (!to) return res.status(400).json({ error: 'Email du destinataire requis.' });
  const r = await dbGetById(tripId);
  if (!r) return res.status(404).json({ error: 'Course introuvable' });

  const formDriverName = String(driverName || '').trim();
  const formPlate = String(driverPlate || '').trim();
  /* Croiser l'annuaire pour combler les champs manquants */
  const allDrivers = await dbListDrivers().catch(() => []);
  const dirMatch = allDrivers.find(d => d.email === to);
  const dirName = String(dirMatch?.name || '').trim();
  const dirPlate = String(dirMatch?.immatriculation || '').trim();
  const nm = formDriverName || dirName;
  const pl = formPlate || dirPlate;
  const assignedDisplay = (nm || to).slice(0, 200);

  const token = missionToken(tripId);
  const missionUrl = `${APP_URL}/mission-order/${tripId}?token=${token}`;
  const html = buildDriverEmailHtml(r, nm, missionUrl, driverPrice, pl, to);
  const subject = `Course IsmaDrive — ${fmtDateFr(r.date)} à ${r.time} — ${assignedDisplay.slice(0, 48)}`;
  try {
    const resend = new Resend(RESEND_API_KEY);
    const { error } = await resend.emails.send({ from: RESEND_FROM, to, subject, html });
    if (error) return res.status(500).json({ error: 'Erreur Resend : ' + (error.message || JSON.stringify(error)) });

    /* Sauvegarder le conducteur assigné sur la réservation */
    await dbUpdate(tripId, {
      driverOrderSentAt: new Date().toISOString(),
      driverOrderSentTo: to,
      assignedDriverName: assignedDisplay || null,
      assignedDriverPlate: pl || null
    }).catch(e => console.error('[send-driver-email] DB update:', e.message));

    /* Mettre à jour ou créer la fiche dans l'annuaire */
    const nameForDir = formDriverName || dirName;
    if (nameForDir) {
      await dbInsertDriver({ id: Date.now().toString(36), name: nameForDir, email: to, phone: '', carCategory: '', immatriculation: pl || '', createdAt: new Date().toISOString() })
        .catch(() => {});
    }
    res.json({ ok: true });
  } catch (e) {
    console.error('[send-driver-email]', e.message);
    res.status(500).json({ error: 'Erreur lors de l\'envoi de l\'email.' });
  }
});

app.post('/api/reservations', publicLimiter, async (req, res) => {
  try {
    const body = req.body || {};
    const email = String(body.email || '').trim();
    if (!email) {
      return res.status(400).json({ ok: false, error: 'Email requis pour envoyer la confirmation.' });
    }

    const reservation = {
      ...body,
      id: body.ref || ('ISMA-' + Date.now().toString(36).toUpperCase().slice(-6)),
      createdAt: new Date().toISOString()
    };

    await dbInsert(reservation);
    console.log('New reservation:', reservation.ref || reservation.id);

    let emailSent = false;
    let emailError = null;

    if (RESEND_API_KEY && RESEND_FROM) {
      try {
        const resend = new Resend(RESEND_API_KEY);
        const qrPayload = buildQrPayload(reservation);
        const qrDataUrl = await qrPayloadToDataUrl(qrPayload);
        const html = buildConfirmationEmailHtml(reservation, qrDataUrl);

        const sendPayload = {
          from: RESEND_FROM,
          to: email,
          subject: `IsmaDrive — Réservation enregistrée · Réf. ${reservation.ref}`,
          html
        };
        if (RESEND_BCC_EMAIL && RESEND_BCC_EMAIL.toLowerCase() !== email.toLowerCase()) {
          sendPayload.bcc = [RESEND_BCC_EMAIL];
        }

        const sendResult = await resend.emails.send(sendPayload);

        if (sendResult.error) {
          console.error('Resend API error:', sendResult.error);
          emailError = sendResult.error.message || JSON.stringify(sendResult.error);
        } else {
          emailSent = true;
        }
      } catch (e) {
        console.error('Resend exception:', e);
        emailError = e.message || String(e);
      }
    } else {
      emailError = 'RESEND_API_KEY ou RESEND_FROM_EMAIL non configurés sur le serveur';
      console.warn(emailError);
    }

    res.json({
      ok: true,
      ref: reservation.ref || reservation.id,
      emailSent,
      emailError: emailSent ? undefined : emailError
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message || 'Erreur serveur' });
  }
});

app.get('/api/reservations', adminLimiter, async (req, res) => {
  const { pwd } = req.query;
  if (pwd !== ADMIN_PWD) return res.status(401).json({ error: 'Non autorisé' });
  try {
    res.json(await dbList());
  } catch (e) {
    console.error('[api/reservations GET]', e.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.patch('/api/reservations/:id', adminLimiter, async (req, res) => {
  const { pwd, ...updates } = req.body || {};
  if (pwd !== ADMIN_PWD) return res.status(401).json({ error: 'Non autorisé' });
  const previous = await dbGetById(req.params.id);
  if (!previous) return res.status(404).json({ error: 'Introuvable' });
  const updated = await dbUpdate(req.params.id, updates);
  if (!updated) return res.status(500).json({ error: 'Erreur mise à jour' });

  if (updates.status === 'done' && previous.status !== 'done') {
    const email = String(updated.email || '').trim();
    if (email && RESEND_API_KEY && RESEND_FROM && GOOGLE_REVIEWS_URL) {
      try {
        const qrDataUrl = await qrPayloadToDataUrl(GOOGLE_REVIEWS_URL);
        const html = buildReviewEmailHtml(updated, qrDataUrl);
        const resend = new Resend(RESEND_API_KEY);
        await resend.emails.send({
          from: RESEND_FROM,
          to: email,
          subject: `IsmaDrive — Merci pour votre confiance · Réf. ${updated.ref || updated.id}`,
          html
        });
        console.log('Review email sent to', email);
      } catch (e) {
        console.error('Review email error:', e.message);
      }
    }
  }

  res.json({ ok: true });
});

app.post('/api/check-availability', publicLimiter, async (req, res) => {
  const { date, time, durationMin, excludeId } = req.body || {};
  if (!date || !time) return res.json({ available: true });
  const conflict = await checkConflict(date, time, durationMin || 60, excludeId);
  if (conflict) {
    return res.json({
      available: false,
      conflict: { ref: conflict.ref, trajet: conflict.trajet, time: conflict.time }
    });
  }
  res.json({ available: true });
});

app.post('/api/create-checkout-session', publicLimiter, async (req, res) => {
  if (!stripe) {
    return res.status(503).json({ error: 'Stripe non configuré — ajoutez STRIPE_SECRET_KEY dans les variables d\'environnement.' });
  }
  const { date, time, durationMin, price, trajet, email } = req.body || {};
  const conflict = await checkConflict(date, time, durationMin || 60);
  if (conflict) return res.status(409).json({ error: 'Créneau indisponible', conflict });

  const id = Date.now().toString(36).toUpperCase().slice(-8);
  const newRes = {
    ...req.body,
    id,
    status: 'pending_payment',
    paymentStatus: 'unpaid',
    createdAt: new Date().toISOString()
  };

  try {
    await dbInsert(newRes);
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: { name: `IsmaDrive — ${trajet || 'Course'}` },
          unit_amount: Math.round((price || 0) * 100),
        },
        quantity: 1,
      }],
      mode: 'payment',
      customer_email: email || undefined,
      success_url: `${APP_URL}/payment-success?ref=${encodeURIComponent(newRes.ref || id)}&session_id={CHECKOUT_SESSION_ID}&lang=${encodeURIComponent(newRes.lang || 'fr')}`,
      cancel_url: `${APP_URL}/?cancelled=1`,
      metadata: { reservationId: id },
    });
    res.json({ url: session.url, id });
  } catch (err) {
    console.error('Checkout error:', err.message);
    res.status(500).json({ error: 'Erreur lors de la création de la session de paiement.' });
  }
});

/* Secours si le webhook Stripe est en retard : page paiement envoie session_id */
app.post('/api/sync-booking-after-payment', async (req, res) => {
  const sessionId = String(req.body?.sessionId || '').trim();
  if (!sessionId) return res.status(400).json({ ok: false, error: 'sessionId requis' });
  if (!stripe) return res.status(503).json({ ok: false, error: 'Stripe non configuré' });
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid') {
      return res.json({ ok: false, reason: 'payment_not_completed' });
    }
    const reservationId = session.metadata?.reservationId;
    if (!reservationId) return res.json({ ok: false, reason: 'no_reservation_in_session' });
    let r = await dbGetById(reservationId);
    if (!r) return res.status(404).json({ ok: false, error: 'reservation_introuvable' });
    r = (await dbGetById(reservationId)) || r;
    const paidNow = new Date().toISOString();
    let transitionedToPaid = false;
    if (r.paymentStatus !== 'paid') {
      transitionedToPaid = true;
      await dbUpdate(reservationId, {
        status: 'confirmed',
        paymentStatus: 'paid',
        stripeSessionId: session.id,
        paidAt: r.paidAt || paidNow
      });
      r = await dbGetById(reservationId);
    }
    if (transitionedToPaid && r) {
      await notifyAdminTelegramPayment(r, 'sync_apres_paiement').catch(e =>
        console.error('[Telegram] admin notify:', e.message)
      );
      await notifyAdminEmailPayment(r, 'sync_apres_paiement').catch(e =>
        console.error('[Resend] admin paiement notify:', e.message)
      );
    }

    const resolvedEmail = String(r.email || session.customer_email || '').trim();
    if (resolvedEmail && !r.email) {
      await dbUpdate(reservationId, { email: resolvedEmail }).catch(() => {});
      r = { ...r, email: resolvedEmail };
    }

    if (resolvedEmail && r.confirmationEmailSent !== true) {
      try {
        await sendClientConfirmationAfterPayment(r, session.customer_email);
        return res.json({ ok: true, emailSent: true });
      } catch (e) {
        console.error('[Resend] confirmation client (sync):', e.message);
        return res.json({ ok: true, emailSent: false, emailError: e.message });
      }
    }

    return res.json({ ok: true, emailSent: false, reason: 'already_sent_or_no_email' });
  } catch (e) {
    console.error('sync-booking-after-payment:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/mission-order/:id', adminLimiter, async (req, res) => {
  const r = await dbGetById(req.params.id).catch(() => null);
  if (!r) return res.status(404).send('Course introuvable');
  const expected = missionToken(req.params.id);
  if (req.query.token !== expected && req.query.pwd !== ADMIN_PWD)
    return res.status(403).send('Accès refusé');
  res.send(buildMissionOrderHtml(r));
});

app.get('/admin', (_req, res) => {
  res.sendFile(path.join(__dirname, 'vtc-project', 'public', 'admin.html'));
});

app.get('/payment-success', (_req, res) => {
  res.sendFile(path.join(__dirname, 'vtc-project', 'public', 'payment-success.html'));
});

/* ── Fichiers statiques ── */
app.use(express.static(path.join(__dirname, 'vtc-project/public')));

const pages = [
  'a-propos', 'faq', 'cgv', 'mentions-legales', 'confidentialite',
  'chauffeur-prive-versailles', 'chauffeur-prive-neuilly-sur-seine',
  'chauffeur-prive-boulogne-billancourt', 'vtc-la-defense', 'vtc-vincennes',
  'transfert-roissy-cdg', 'transfert-orly-paris', 'cdg-airport-transfer-paris',
  'orly-airport-transfer-paris'
];

pages.forEach(slug => {
  app.get(`/${slug}`, (req, res) => {
    res.sendFile(path.join(__dirname, 'vtc-project', 'public', `${slug}.html`));
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'vtc-project', 'public', 'index.html'));
});

module.exports = app;

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    const resendReady = !!(RESEND_API_KEY && RESEND_FROM);
    if (resendReady) {
      console.log('Resend: configuré (emails de confirmation actifs)');
    } else if (process.env.VERCEL) {
      console.warn('Resend: RESEND_API_KEY ou RESEND_FROM_EMAIL manquant — vérifier les variables sur Vercel');
    } else {
      console.log('Resend: désactivé en local (clés souvent uniquement sur Vercel — voir DEPLOY-VERCEL.md)');
    }
  });
}
