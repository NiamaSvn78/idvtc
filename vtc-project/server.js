if (process.env.NODE_ENV !== 'production') require('dotenv').config({ path: '.env.local' });
const express = require('express');
const path    = require('path');
const crypto  = require('crypto');
const QRCode  = require('qrcode');
const { Resend } = require('resend');
const { createClient } = require('@supabase/supabase-js');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || '');

const app  = express();
const PORT = process.env.PORT || 3000;

/* ── SUPABASE (même projet par défaut que index.js à la racine du repo) ── */
const DEFAULT_SUPABASE_URL = 'https://hawwbdpixtmdgnftklsd.supabase.co';
const supabaseUrl = (process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, '');
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

if (supabaseServiceKey) {
  try {
    console.log('[Supabase]', new URL(supabaseUrl).hostname);
  } catch (_) {
    console.warn('[Supabase] SUPABASE_URL invalide');
  }
} else {
  console.warn('[Supabase] SUPABASE_SERVICE_ROLE_KEY manquant — les écritures en base échoueront.');
}

/* ── CONFIG ── */
const ADMIN_PWD          = process.env.ADMIN_PWD || 'idvtc2024';
const BUFFER_MIN         = 0;
const APP_URL            = (
  process.env.APP_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null) ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
  `http://localhost:${PORT}`
).replace(/\/$/, '');
const GOOGLE_REVIEWS_URL = process.env.GOOGLE_REVIEWS_URL || 'https://g.page/r/CWL4dJY-hj2oEAE/review';
const RESEND_API_KEY     = process.env.RESEND_API_KEY || '';
const RESEND_FROM_EMAIL  = process.env.RESEND_FROM_EMAIL || '';
const RESEND_FROM        = RESEND_FROM_EMAIL ? `IsmaDrive <${RESEND_FROM_EMAIL}>` : '';
const RESEND_BCC_EMAIL   = String(process.env.RESEND_BCC_EMAIL || '').trim();
/** Même contenu que la notif Telegram ; surcharge possible via ADMIN_PAYMENT_NOTIFY_EMAIL */
const ADMIN_PAYMENT_NOTIFY_EMAIL = String(
  process.env.ADMIN_PAYMENT_NOTIFY_EMAIL || 'diabyismaila80@gmail.com'
).trim();

/** Envoie via Resend ; renvoie { data, error } (les erreurs API ne lèvent pas toujours d'exception). */
async function resendEmailsSend(payload) {
  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL) {
    const msg = 'RESEND_API_KEY ou RESEND_FROM_EMAIL manquant';
    console.warn('[Resend]', msg);
    return { data: null, error: { message: msg } };
  }
  const resend = new Resend(RESEND_API_KEY);
  const out = await resend.emails.send(payload);
  if (out.error) console.error('[Resend] Erreur API:', out.error);
  return out;
}

/* ── EXPLOITANT ── */
const EXPLOITANT = {
  raisonSociale: 'ISMA TRANS',
  exploitant:    'DIABY ISMAILA',
  siret:        process.env.SIRET         || '849 624 374 00013',
  numeroREVTC:  process.env.NUMERO_REVTC  || 'EVTC075210338',
  telephone:    '+33 6 23 88 97 17',
  email:        'contact@ismadrive.fr',
  adresse:      '2 rue du Colonel Domine, 75013 Paris'
};

function vehicleDisplayName(r) {
  const v = String(r.vehicle || '').toLowerCase();
  return v === 'van' ? 'Mercedes Classe V et équivalent' : 'Mercedes Classe E et équivalent';
}

function generateResRef() {
  const now = new Date();
  const d = now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0');
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let rand = '';
  for (let i = 0; i < 6; i++) rand += chars[Math.floor(Math.random() * chars.length)];
  return `RES-${d}-${rand}`;
}

function checkAdminAuth(req) {
  if (req.body?.pwd  === ADMIN_PWD) return true;
  if (req.query?.pwd === ADMIN_PWD) return true;
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Basic ')) {
    const decoded = Buffer.from(auth.slice(6), 'base64').toString();
    const colon   = decoded.indexOf(':');
    const pass    = colon >= 0 ? decoded.slice(colon + 1) : decoded;
    if (pass === ADMIN_PWD) return true;
  }
  return false;
}

function requireBasicAuth(req, res, next) {
  if (checkAdminAuth(req)) return next();
  res.setHeader('WWW-Authenticate', 'Basic realm="IsmaDrive Admin"');
  return res.status(401).send('Accès refusé');
}

/* ── DB HELPERS ── */
function wrapSupabaseErr(error) {
  const msg = error?.message || String(error);
  let fullMsg = msg;
  if (/schema cache|could not find the table/i.test(msg)) {
    fullMsg = msg + ' Vérifiez que SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sur Vercel sont ceux du même projet Supabase où la table public.reservations existe (SQL / migrations).';
  }
  const err = new Error(fullMsg);
  err.pgCode   = error?.code    || null;
  err.pgDetail = error?.details || null;
  err.pgHint   = error?.hint    || null;
  return err;
}

async function dbInsertRes(r) {
  const { error, status } = await supabase.from('reservations').insert(r);
  if (error) {
    const err = wrapSupabaseErr(error);
    err.supabaseStatus = status;
    throw err;
  }
}

async function dbListRes() {
  const { data, error } = await supabase.from('reservations').select('*').order('createdAt', { ascending: false });
  if (error) throw wrapSupabaseErr(error);
  return data || [];
}

async function dbGetRes(id) {
  const { data } = await supabase.from('reservations').select('*').eq('id', id).single();
  return data || null;
}

async function dbUpdateRes(id, updates) {
  const { error } = await supabase.from('reservations').update(updates).eq('id', id);
  if (error) throw wrapSupabaseErr(error);
}

async function dbListResByDate(date) {
  const { data } = await supabase.from('reservations').select('*').eq('date', date).neq('status', 'cancelled');
  return data || [];
}

async function dbGetResByCancellationToken(token) {
  const { data } = await supabase.from('reservations').select('*').eq('cancellationToken', token).maybeSingle();
  return data || null;
}

function computeCancellationTier(r) {
  const [y, mo, d] = (r.date || '').split('-').map(Number);
  const [h, m] = (r.time || '00:00').split(':').map(Number);
  if (!y || !mo || !d) return 'none';
  const courseDate = new Date(y, mo - 1, d, h, m, 0);
  const diffH = (courseDate.getTime() - Date.now()) / 3600000;
  if (diffH > 72) return 'full';
  if (diffH > 12) return 'half';
  return 'none';
}

async function dbListDrivers() {
  const { data } = await supabase.from('drivers').select('*').order('createdAt', { ascending: false });
  return data || [];
}

async function dbInsertDriver(d) {
  const { error } = await supabase.from('drivers').upsert(d, { onConflict: 'email', ignoreDuplicates: true });
  if (error) throw new Error(error.message);
}

async function dbUpdateDriver(id, updates) {
  const { error } = await supabase.from('drivers').update(updates).eq('id', id);
  if (error) throw new Error(error.message);
}

async function dbDeleteDriver(id) {
  const { error } = await supabase.from('drivers').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/** Partie affichable avant @ (secours si le nom n'a pas été saisi). */
function emailLocalPart(email) {
  const t = String(email || '').trim();
  if (!t) return '';
  const i = t.indexOf('@');
  return i > 0 ? t.slice(0, i) : t;
}

/** Cherche un conducteur dans l'annuaire (email insensible à la casse, sans piège ILIKE sur _). */
async function dbGetDriverByEmail(email) {
  const raw = String(email || '').trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  const { data: exact, error: e1 } = await supabase.from('drivers').select('*').eq('email', raw).maybeSingle();
  if (e1) console.warn('[drivers] dbGetDriverByEmail eq:', e1.message);
  if (exact) return exact;
  const { data: exactLower, error: e2 } = await supabase.from('drivers').select('*').eq('email', lower).maybeSingle();
  if (e2) console.warn('[drivers] dbGetDriverByEmail eq lower:', e2.message);
  if (exactLower) return exactLower;
  const { data: rows, error: e3 } = await supabase.from('drivers').select('*');
  if (e3) {
    console.warn('[drivers] dbGetDriverByEmail scan:', e3.message);
    return null;
  }
  return (rows || []).find((d) => String(d.email || '').toLowerCase() === lower) || null;
}

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
function fmtDateTimeFr(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso).slice(0, 19);
    return d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  } catch (_) {
    return String(iso);
  }
}
function addMinToTime(time, min) {
  const total = timeToMin(time) + Number(min);
  return String(Math.floor(total / 60) % 24).padStart(2,'0') + ':' + String(total % 60).padStart(2,'0');
}
function missionToken(id) {
  return crypto.createHmac('sha256', ADMIN_PWD).update(id).digest('hex').slice(0, 20);
}

const PENDING_LOCK_MS = 15 * 60 * 1000; // 15 min — délai max pour finaliser un paiement Stripe

async function checkConflict(date, time, durationMin, excludeId = null) {
  const now      = Date.now();
  const newStart = timeToMin(time);
  const newEnd   = newStart + Number(durationMin) + BUFFER_MIN;
  const dayRes   = (await dbListResByDate(date)).filter(r => {
    if (r.id === excludeId) return false;
    // Une réservation pending_payment abandonnée (> 15 min) ne bloque plus le créneau
    if (r.status === 'pending_payment') {
      return (now - new Date(r.createdAt).getTime()) < PENDING_LOCK_MS;
    }
    return true;
  });
  for (const r of dayRes) {
    const rStart = timeToMin(r.time);
    const rEnd   = rStart + Number(r.durationMin || 60) + BUFFER_MIN;
    if (newStart < rEnd && newEnd > rStart) return r;
  }
  return null;
}
async function nextSlot(date, durationMin, afterTime = null) {
  const dayRes = (await dbListResByDate(date))
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
function buildDriverEmailHtml(r, driverName, missionUrl, driverPrice, qrDataUrl, driverPlate, driverEmailTo) {
  const dn = String(driverName || '').trim();
  const dp = String(driverPlate || '').trim();
  const dem = String(driverEmailTo || '').trim();
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
  const calLines = [
    `Client : ${r.client || ''}`,
    `Tél. : ${r.tel || ''}`,
    '',
    `Bon IsmaDrive — destinataire de ce bon : ${dn || '—'}${dp ? ' · Immat. ' + dp : ''}`,
    dem ? `Email du destinataire : ${dem}` : '',
    '',
    'Ne pas réattribuer cette course à un autre chauffeur sans coordination avec IsmaDrive.'
  ];
  const calDesc  = encodeURIComponent(calLines.join('\n'));
  const calLoc   = encodeURIComponent(dep);
  const googleCal  = `https://www.google.com/calendar/render?action=TEMPLATE&text=${calTitle}&dates=${calStart}%2F${calEnd}&details=${calDesc}&location=${calLoc}`;
  const outlookCal = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${calTitle}&startdt=${r.date}T${r.time}:00&enddt=${r.date}T${endTime}:00&body=${calDesc}&location=${calLoc}`;

  const dnEsc = escHtml(dn);
  const dpEsc = escHtml(dp);
  const demEsc = escHtml(dem);
  const greeting = dn ? `Bonjour ${dnEsc},` : 'Bonjour,';

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
    ${dem ? `<p style="margin:0 0 10px;font-size:.82rem;color:#666">Ce message est destiné à <strong>${demEsc}</strong> — merci de vérifier qu'il s'agit bien de vous avant d'ajouter l'événement au calendrier (évite les doubles envois).</p>` : ''}
    <p style="margin:0 0 24px;font-size:.85rem;color:#666">
      Ajouter au calendrier :
      <a href="${googleCal}" style="color:#c9a96e;text-decoration:none">Google Agenda</a>
      &nbsp;—&nbsp;
      <a href="${outlookCal}" style="color:#c9a96e;text-decoration:none">Outlook</a>
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;border:1px solid #e8e0d0">
    <tr><td style="padding:14px 16px;background:#fffbf2">
      <div style="font-size:.68rem;color:#9a9185;text-transform:uppercase;letter-spacing:.14em;margin-bottom:6px">Vous (conducteur assigné)</div>
      <div style="font-size:1.05rem;font-weight:bold;color:#080808">${dnEsc || '<span style="color:#888;font-weight:500">—</span>'}</div>
      ${dp ? `<div style="font-size:.88rem;margin-top:8px;color:#333"><strong>Immatriculation :</strong> <span style="font-family:monospace;letter-spacing:.08em">${dpEsc}</span></div>` : '<div style="font-size:.82rem;margin-top:6px;color:#888">Immatriculation non renseignée</div>'}
    </td></tr></table>
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
      <div style="font-size:.92rem;margin-bottom:5px"><strong>Client :</strong> ${escHtml(r.client || '—')}</div>
      <div style="font-size:.92rem"><strong>Téléphone :</strong> <a href="tel:${r.tel||''}" style="color:#c9a96e;text-decoration:none">${escHtml(r.tel || '—')}</a></div>
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
      <div style="font-size:.82rem;color:#f0ece4;margin-bottom:16px">Scannez le QR ou cliquez pour accéder à votre bon de commande :</div>
      ${qrDataUrl ? `<img src="${qrDataUrl}" width="160" height="160" alt="QR ordre de mission" style="display:block;margin:0 auto 16px;border:3px solid #c9a96e;border-radius:2px"/>` : ''}
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

function buildMissionOrderHtml(r, qrDataUrl) {
  const dateStr = fmtDateFr(r.date);
  const dep = r.depLabel || (r.trajet || '').split(/[→>]/)[0]?.trim() || '—';
  const arr = r.arrLabel || (r.trajet || '').split(/[→>]/)[1]?.trim() || '—';
  const depEnc = encodeURIComponent(dep);
  const arrEnc = encodeURIComponent(arr);
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
@media print{body{background:#fff;padding:0}.card{box-shadow:none}a{color:#333!important}.print-hide{display:none}}
</style>
</head>
<body>
<div class="card">
  <div class="card-head">
    <div class="logo">IsmaDrive</div>
    <div class="ref-block">
      <div class="ref">Réf. ${r.ref||r.id}${r._courseLabel ? ' · ' + escHtml(r._courseLabel) : ''}</div>
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
    ${(() => {
      const { notesFreeTextOnly } = require('../lib/booking-courses');
      const free = notesFreeTextOnly(r.notes);
      return free ? `<div style="margin-top:12px"><div class="lbl">Notes</div><div class="val" style="font-size:.85rem;color:#555">${escHtml(free)}</div></div>` : '';
    })()}
  </div>
  <div class="section" style="background:#fffbf2;border-left:3px solid #c9a96e">
    <div style="font-size:.63rem;color:#9a9185;text-transform:uppercase;letter-spacing:.15em;margin-bottom:10px">Conducteur assigné (bon)</div>
    <div class="grid2">
      <div>
        <div class="lbl">Nom</div>
        <div class="val" style="font-size:1.15rem;font-weight:bold;color:#080808">${driverNameHtml}</div>
      </div>
      ${plateCell}
    </div>
    ${r.driverOrderSentTo ? `<div style="margin-top:12px;font-size:.78rem;color:#777;line-height:1.45">Bon transmis à l'adresse <strong style="color:#555">${escHtml(r.driverOrderSentTo)}</strong> (anti-doublon).</div>` : ''}
  </div>
  <div class="qr-block">
    <div style="font-size:.68rem;color:#bbb;margin-bottom:10px;text-transform:uppercase;letter-spacing:.12em">QR Code client — scanner pour valider</div>
    ${qrDataUrl ? `<img src="${qrDataUrl}" width="130" height="130" alt="QR code validation client">` : ''}
    <div style="font-size:.65rem;color:#ccc;margin-top:8px">Le client présente ce même QR sur son téléphone</div>
  </div>
  <div class="print-hide" style="padding:16px 28px;text-align:center;background:#f9f9f9;border-top:1px solid #eee">
    <button onclick="window.print()" style="background:#080808;color:#c9a96e;border:none;padding:11px 28px;font-size:.82rem;letter-spacing:.08em;cursor:pointer;font-family:Arial,sans-serif;border-radius:2px">⬇ Télécharger / Imprimer le bon de commande</button>
  </div>
</div>
</body></html>`;
}

/* ── EMAIL CONFIRMATION CLIENT (après paiement Stripe) ── */
async function buildConfirmationQrDataUrl(r) {
  const id  = r.id || '';
  const url = `${APP_URL}/reservation/${id}`;
  return QRCode.toDataURL(url, {
    width: 260, margin: 2, errorCorrectionLevel: 'M',
    type: 'image/png', color: { dark: '#000000', light: '#ffffff' }
  });
}

function buildClientConfirmationHtml(r, qrDataUrl, prestDetails = [], prestQrs = []) {
  if (r.lang === 'en') return buildClientConfirmationHtmlEN(r, qrDataUrl, prestDetails, prestQrs);
  const client  = escHtml(r.client || 'cher client');
  const ref     = escHtml(r.ref || r.id || '');
  const trajet  = escHtml(r.trajet || '—');
  const dateStr = escHtml(fmtDateFr(r.date));
  const time    = escHtml(r.time || '—');
  const veh     = escHtml(r.vehicleName || r.vehicle || '—');
  const price   = escHtml(String(r.price || '—'));
  const equip          = r.equipment ? `<tr><td style="padding:6px 0;border-bottom:1px solid #f0ece4;color:#888;font-size:13px">Équipement</td><td style="padding:6px 0;border-bottom:1px solid #f0ece4;text-align:right;font-size:13px">${escHtml(r.equipment)}</td></tr>` : '';
  const tripModeRow    = (r.tripMode && r.tripMode !== 'one-way') ? `<tr><td style="padding:6px 0;border-bottom:1px solid #f0ece4;color:#888;font-size:13px">Type de trajet</td><td style="padding:6px 0;border-bottom:1px solid #f0ece4;text-align:right;font-size:13px;color:#333">Aller-retour</td></tr>` : '';
  const returnAddrRow  = r.returnAddr ? `<tr><td style="padding:6px 0;border-bottom:1px solid #f0ece4;color:#888;font-size:13px">Adresse de retour</td><td style="padding:6px 0;border-bottom:1px solid #f0ece4;text-align:right;font-size:13px;color:#333">${escHtml(r.returnAddr)}</td></tr>` : '';
  const returnDateRow  = r.returnDate ? `<tr><td style="padding:6px 0;border-bottom:1px solid #f0ece4;color:#888;font-size:13px">Date &amp; Heure retour</td><td style="padding:6px 0;border-bottom:1px solid #f0ece4;text-align:right;font-size:13px;color:#333">${escHtml(fmtDateFr(r.returnDate))} à ${escHtml(r.returnTime||'—')}</td></tr>` : '';
  const reservationUrl = `${APP_URL}/reservation/${r.id || ''}`;

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;color:#333">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:24px 0">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:4px;overflow:hidden;border:1px solid #e8e8e8">

  <!-- Header -->
  <tr><td style="background:#080808;padding:24px 32px;border-bottom:2px solid #c9a96e">
    <div style="font-family:Georgia,serif;font-size:1.5rem;color:#c9a96e;letter-spacing:.1em">IsmaDrive</div>
    <div style="font-size:.68rem;color:#9a9185;letter-spacing:.2em;text-transform:uppercase;margin-top:4px">Confirmation de réservation</div>
  </td></tr>

  <!-- Confirmation badge -->
  <tr><td style="background:#080808;padding:28px 32px 24px;text-align:center;border-bottom:1px solid #1a1a1a">
    <div style="width:56px;height:56px;background:rgba(39,174,96,.15);border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-bottom:14px">
      <span style="font-size:26px;line-height:1">✓</span>
    </div>
    <div style="font-family:Georgia,serif;font-size:1.6rem;font-weight:400;color:#f0ece4;margin-bottom:6px">Paiement confirmé</div>
    <div style="font-size:.85rem;color:#9a9185">Votre réservation est enregistrée. Votre chauffeur sera ponctuel.</div>
  </td></tr>

  <!-- Détails réservation -->
  <tr><td style="padding:28px 32px 20px">
    <p style="margin:0 0 6px;font-size:15px;line-height:1.6">Bonjour <strong>${client}</strong>,</p>
    <p style="margin:0 0 20px;font-size:14px;color:#555;line-height:1.65">Votre paiement a bien été reçu. Retrouvez ci-dessous le récapitulatif de votre course et votre QR code obligatoire.</p>

    <div style="background:#f9f7f4;border:1px solid #e8e0d0;border-radius:3px;padding:16px 20px;margin-bottom:22px">
      <div style="font-size:.63rem;color:#9a9185;text-transform:uppercase;letter-spacing:.16em;margin-bottom:12px">Récapitulatif</div>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding:6px 0;border-bottom:1px solid #e8e0d0;color:#888;font-size:13px">Référence</td><td style="padding:6px 0;border-bottom:1px solid #e8e0d0;text-align:right;font-weight:bold;color:#080808;font-size:13px;letter-spacing:.05em">${ref}</td></tr>
        <tr><td style="padding:6px 0;border-bottom:1px solid #f0ece4;color:#888;font-size:13px">Trajet</td><td style="padding:6px 0;border-bottom:1px solid #f0ece4;text-align:right;font-size:13px;color:#333">${trajet}</td></tr>
        ${tripModeRow}
        ${returnAddrRow}
        ${returnDateRow}
        <tr><td style="padding:6px 0;border-bottom:1px solid #f0ece4;color:#888;font-size:13px">Date &amp; Heure aller</td><td style="padding:6px 0;border-bottom:1px solid #f0ece4;text-align:right;font-size:13px;color:#333">${dateStr} à ${time}</td></tr>
        <tr><td style="padding:6px 0;border-bottom:1px solid #f0ece4;color:#888;font-size:13px">Véhicule</td><td style="padding:6px 0;border-bottom:1px solid #f0ece4;text-align:right;font-size:13px;color:#333">${veh}</td></tr>
        ${equip}
        <tr><td style="padding:8px 0 0;color:#333;font-size:14px;font-weight:bold">Total payé</td><td style="padding:8px 0 0;text-align:right;font-size:16px;font-weight:bold;color:#c9a96e">${price} €</td></tr>
      </table>
    </div>

    <!-- Numéro de réservation -->
    <div style="text-align:center;margin-bottom:18px;padding:16px 20px;background:#f9f7f4;border:1px solid #e8e0d0;border-radius:3px">
      <div style="font-size:.65rem;color:#9a9185;text-transform:uppercase;letter-spacing:.16em;margin-bottom:8px">Votre numéro de réservation</div>
      <div style="font-size:1.5rem;font-weight:bold;font-family:monospace;color:#080808;letter-spacing:.06em">${ref}</div>
      <div style="font-size:.75rem;color:#999;margin-top:4px">À dicter à votre chauffeur si besoin</div>
    </div>

    <!-- QR code block -->
    <div style="background:#080808;border:1px solid #c9a96e;border-radius:3px;padding:22px;text-align:center;margin-bottom:16px">
      <div style="font-size:.63rem;color:#9a9185;letter-spacing:.2em;text-transform:uppercase;margin-bottom:6px">QR code obligatoire</div>
      <div style="font-family:Georgia,serif;font-size:1rem;color:#c9a96e;margin-bottom:16px">À présenter au conducteur avant le départ</div>
      <img src="${qrDataUrl}" width="200" height="200" alt="QR code réservation IsmaDrive" style="display:block;margin:0 auto;border:4px solid #fff;border-radius:2px"/>
      <div style="margin-top:10px;font-size:.72rem;color:#777">Sauvegardez ce mail ou faites une capture d'écran.</div>
    </div>


    ${prestDetails.length > 0 ? prestDetails.map((detail, i) => `
    <tr><td style="padding:0 32px 20px">
      <div style="border-top:1px solid #e8e0d0;padding-top:16px">
        <div style="font-size:.63rem;color:#9a9185;text-transform:uppercase;letter-spacing:.16em;margin-bottom:8px">Course ${i + 2}</div>
        <div style="background:#f9f7f4;border:1px solid #e8e0d0;border-radius:3px;padding:12px 16px;margin-bottom:14px;font-size:.83rem;color:#444;line-height:1.5">${escHtml(detail)}</div>
        ${prestQrs[i] ? `<div style="background:#080808;border:1px solid #c9a96e;border-radius:3px;padding:16px;text-align:center;margin-bottom:8px">
          <div style="font-size:.6rem;color:#9a9185;letter-spacing:.15em;text-transform:uppercase;margin-bottom:6px">QR code — Course ${i + 2}</div>
          <img src="${prestQrs[i]}" width="160" height="160" alt="QR code course ${i + 2}" style="display:block;margin:0 auto;border:3px solid #fff;border-radius:2px"/>
        </div>` : ''}
      </div>
    </td></tr>`).join('') : ''}

    <!-- Bouton + URL en clair -->
    <div style="text-align:center;margin-bottom:12px">
      <a href="${reservationUrl}" style="display:inline-block;background:#080808;color:#fff;padding:12px 28px;text-decoration:none;font-size:.85rem;font-weight:bold;border-radius:4px;letter-spacing:.04em">📋 Accéder à ma réservation</a>
    </div>
    <div style="text-align:center;margin-bottom:18px">
      <div style="font-size:.75rem;color:#888;margin-bottom:6px">Ou copiez ce lien dans votre navigateur :</div>
      <div style="background:#f5f5f5;color:#333;padding:10px;font-size:.78rem;word-break:break-all;border-radius:3px;border:1px solid #eee;font-family:monospace;text-align:left">${reservationUrl}</div>
    </div>
    <p style="text-align:center;font-size:.8rem;color:#666;margin:0 0 22px;line-height:1.5">Présentez l'un de ces éléments à votre chauffeur.</p>

    <p style="font-size:.85rem;color:#666;margin:0 0 8px;line-height:1.65">Une question ou un changement de dernière minute ?</p>
    <p style="margin:0 0 18px;font-size:.85rem">
      <a href="https://wa.me/33623889717" style="color:#c9a96e;text-decoration:none">WhatsApp : +33 6 23 88 97 17</a>
    </p>
    <div style="padding-top:12px;border-top:1px solid #eee;text-align:center">
      <a href="https://ismadrive.fr/cgv" style="color:#bbb;font-size:11px;text-decoration:underline">Politique d'annulation</a>${r.cancellationToken ? ` &nbsp;·&nbsp; <a href="${APP_URL}/annuler-reservation?token=${encodeURIComponent(r.cancellationToken)}" style="color:#bbb;font-size:11px;text-decoration:underline">Annuler ma réservation</a>` : ''}
    </div>
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#f9f9f9;border-top:1px solid #eee;padding:14px 32px;text-align:center">
    <div style="font-size:11px;color:#aaa">Réf. ${ref} &nbsp;·&nbsp; IsmaDrive — Chauffeur Privé Paris &amp; Île-de-France &nbsp;·&nbsp; <a href="https://ismadrive.fr" style="color:#c9a96e;text-decoration:none">ismadrive.fr</a></div>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;
}

function buildClientConfirmationHtmlEN(r, qrDataUrl) {
  const client  = escHtml(r.client || 'valued customer');
  const ref     = escHtml(r.ref || r.id || '');
  const trajet  = escHtml(r.trajet || '—');
  const dateStr = escHtml(fmtDateFr(r.date));
  const time    = escHtml(r.time || '—');
  const veh     = escHtml(r.vehicleName || r.vehicle || '—');
  const price   = escHtml(String(r.price || '—'));
  const equip          = r.equipment ? `<tr><td style="padding:6px 0;border-bottom:1px solid #f0ece4;color:#888;font-size:13px">Equipment</td><td style="padding:6px 0;border-bottom:1px solid #f0ece4;text-align:right;font-size:13px">${escHtml(r.equipment)}</td></tr>` : '';
  const tripModeRow    = (r.tripMode && r.tripMode !== 'one-way') ? `<tr><td style="padding:6px 0;border-bottom:1px solid #f0ece4;color:#888;font-size:13px">Trip type</td><td style="padding:6px 0;border-bottom:1px solid #f0ece4;text-align:right;font-size:13px;color:#333">Round trip</td></tr>` : '';
  const returnAddrRow  = r.returnAddr ? `<tr><td style="padding:6px 0;border-bottom:1px solid #f0ece4;color:#888;font-size:13px">Return address</td><td style="padding:6px 0;border-bottom:1px solid #f0ece4;text-align:right;font-size:13px;color:#333">${escHtml(r.returnAddr)}</td></tr>` : '';
  const returnDateRow  = r.returnDate ? `<tr><td style="padding:6px 0;border-bottom:1px solid #f0ece4;color:#888;font-size:13px">Return date &amp; time</td><td style="padding:6px 0;border-bottom:1px solid #f0ece4;text-align:right;font-size:13px;color:#333">${escHtml(fmtDateFr(r.returnDate))} at ${escHtml(r.returnTime||'—')}</td></tr>` : '';
  const reservationUrl = `${APP_URL}/reservation/${r.id || ''}`;

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;color:#333">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:24px 0">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:4px;overflow:hidden;border:1px solid #e8e8e8">

  <!-- Header -->
  <tr><td style="background:#080808;padding:24px 32px;border-bottom:2px solid #c9a96e">
    <div style="font-family:Georgia,serif;font-size:1.5rem;color:#c9a96e;letter-spacing:.1em">IsmaDrive</div>
    <div style="font-size:.68rem;color:#9a9185;letter-spacing:.2em;text-transform:uppercase;margin-top:4px">Booking confirmation</div>
  </td></tr>

  <!-- Confirmation badge -->
  <tr><td style="background:#080808;padding:28px 32px 24px;text-align:center;border-bottom:1px solid #1a1a1a">
    <div style="width:56px;height:56px;background:rgba(39,174,96,.15);border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-bottom:14px">
      <span style="font-size:26px;line-height:1">✓</span>
    </div>
    <div style="font-family:Georgia,serif;font-size:1.6rem;font-weight:400;color:#f0ece4;margin-bottom:6px">Payment confirmed</div>
    <div style="font-size:.85rem;color:#9a9185">Your booking is confirmed. Your driver will be on time.</div>
  </td></tr>

  <!-- Booking details -->
  <tr><td style="padding:28px 32px 20px">
    <p style="margin:0 0 6px;font-size:15px;line-height:1.6">Hello <strong>${client}</strong>,</p>
    <p style="margin:0 0 20px;font-size:14px;color:#555;line-height:1.65">Your payment has been received. Below is your booking summary and your mandatory QR code.</p>

    <div style="background:#f9f7f4;border:1px solid #e8e0d0;border-radius:3px;padding:16px 20px;margin-bottom:22px">
      <div style="font-size:.63rem;color:#9a9185;text-transform:uppercase;letter-spacing:.16em;margin-bottom:12px">Summary</div>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding:6px 0;border-bottom:1px solid #e8e0d0;color:#888;font-size:13px">Reference</td><td style="padding:6px 0;border-bottom:1px solid #e8e0d0;text-align:right;font-weight:bold;color:#080808;font-size:13px;letter-spacing:.05em">${ref}</td></tr>
        <tr><td style="padding:6px 0;border-bottom:1px solid #f0ece4;color:#888;font-size:13px">Trip</td><td style="padding:6px 0;border-bottom:1px solid #f0ece4;text-align:right;font-size:13px;color:#333">${trajet}</td></tr>
        ${tripModeRow}
        ${returnAddrRow}
        ${returnDateRow}
        <tr><td style="padding:6px 0;border-bottom:1px solid #f0ece4;color:#888;font-size:13px">Outbound date &amp; time</td><td style="padding:6px 0;border-bottom:1px solid #f0ece4;text-align:right;font-size:13px;color:#333">${dateStr} at ${time}</td></tr>
        <tr><td style="padding:6px 0;border-bottom:1px solid #f0ece4;color:#888;font-size:13px">Vehicle</td><td style="padding:6px 0;border-bottom:1px solid #f0ece4;text-align:right;font-size:13px;color:#333">${veh}</td></tr>
        ${equip}
        <tr><td style="padding:8px 0 0;color:#333;font-size:14px;font-weight:bold">Total paid</td><td style="padding:8px 0 0;text-align:right;font-size:16px;font-weight:bold;color:#c9a96e">${price} €</td></tr>
      </table>
    </div>

    <!-- Booking reference -->
    <div style="text-align:center;margin-bottom:18px;padding:16px 20px;background:#f9f7f4;border:1px solid #e8e0d0;border-radius:3px">
      <div style="font-size:.65rem;color:#9a9185;text-transform:uppercase;letter-spacing:.16em;margin-bottom:8px">Your booking reference</div>
      <div style="font-size:1.5rem;font-weight:bold;font-family:monospace;color:#080808;letter-spacing:.06em">${ref}</div>
      <div style="font-size:.75rem;color:#999;margin-top:4px">You can also give this number to your driver</div>
    </div>

    <!-- QR code block -->
    <div style="background:#080808;border:1px solid #c9a96e;border-radius:3px;padding:22px;text-align:center;margin-bottom:16px">
      <div style="font-size:.63rem;color:#9a9185;letter-spacing:.2em;text-transform:uppercase;margin-bottom:6px">Mandatory QR code</div>
      <div style="font-family:Georgia,serif;font-size:1rem;color:#c9a96e;margin-bottom:16px">Show to your driver before departure</div>
      <img src="${qrDataUrl}" width="200" height="200" alt="IsmaDrive booking QR code" style="display:block;margin:0 auto;border:4px solid #fff;border-radius:2px"/>
      <div style="margin-top:10px;font-size:.72rem;color:#777">Save this email or take a screenshot.</div>
    </div>


    ${prestDetails.length > 0 ? prestDetails.map((detail, i) => `
    <tr><td style="padding:0 32px 20px">
      <div style="border-top:1px solid #e8e0d0;padding-top:16px">
        <div style="font-size:.63rem;color:#9a9185;text-transform:uppercase;letter-spacing:.16em;margin-bottom:8px">Ride ${i + 2}</div>
        <div style="background:#f9f7f4;border:1px solid #e8e0d0;border-radius:3px;padding:12px 16px;margin-bottom:14px;font-size:.83rem;color:#444;line-height:1.5">${escHtml(detail)}</div>
        ${prestQrs[i] ? `<div style="background:#080808;border:1px solid #c9a96e;border-radius:3px;padding:16px;text-align:center;margin-bottom:8px">
          <div style="font-size:.6rem;color:#9a9185;letter-spacing:.15em;text-transform:uppercase;margin-bottom:6px">QR code — Ride ${i + 2}</div>
          <img src="${prestQrs[i]}" width="160" height="160" alt="QR code ride ${i + 2}" style="display:block;margin:0 auto;border:3px solid #fff;border-radius:2px"/>
        </div>` : ''}
      </div>
    </td></tr>`).join('') : ''}

    <!-- Button + plain URL -->
    <div style="text-align:center;margin-bottom:12px">
      <a href="${reservationUrl}" style="display:inline-block;background:#080808;color:#fff;padding:12px 28px;text-decoration:none;font-size:.85rem;font-weight:bold;border-radius:4px;letter-spacing:.04em">📋 Access my booking</a>
    </div>
    <div style="text-align:center;margin-bottom:18px">
      <div style="font-size:.75rem;color:#888;margin-bottom:6px">Or copy this link in your browser:</div>
      <div style="background:#f5f5f5;color:#333;padding:10px;font-size:.78rem;word-break:break-all;border-radius:3px;border:1px solid #eee;font-family:monospace;text-align:left">${reservationUrl}</div>
    </div>
    <p style="text-align:center;font-size:.8rem;color:#666;margin:0 0 22px;line-height:1.5">Present any of these to your driver.</p>

    <p style="font-size:.85rem;color:#666;margin:0 0 8px;line-height:1.65">A question or last-minute change?</p>
    <p style="margin:0 0 18px;font-size:.85rem">
      <a href="https://wa.me/33623889717" style="color:#c9a96e;text-decoration:none">WhatsApp: +33 6 23 88 97 17</a>
    </p>
    <div style="padding-top:12px;border-top:1px solid #eee;text-align:center">
      <a href="https://ismadrive.fr/cgv" style="color:#bbb;font-size:11px;text-decoration:underline">Cancellation policy</a>${r.cancellationToken ? ` &nbsp;·&nbsp; <a href="${APP_URL}/annuler-reservation?token=${encodeURIComponent(r.cancellationToken)}" style="color:#bbb;font-size:11px;text-decoration:underline">Cancel my booking</a>` : ''}
    </div>
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#f9f9f9;border-top:1px solid #eee;padding:14px 32px;text-align:center">
    <div style="font-size:11px;color:#aaa">Ref. ${ref} &nbsp;·&nbsp; IsmaDrive — Private Driver Paris &amp; Île-de-France &nbsp;·&nbsp; <a href="https://ismadrive.fr" style="color:#c9a96e;text-decoration:none">ismadrive.fr</a></div>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;
}

async function sendClientConfirmationEmail(r) {
  const email = String(r.email || '').trim();
  if (!email) return { ok: false, reason: 'no_email' };
  if (r.confirmationEmailSent === true) {
    console.log('[Resend] Confirmation déjà enregistrée, pas de renvoi —', r.ref || r.id);
    return { ok: true, skipped: true };
  }

  // CID inline attachment : évite le blocage base64 dans Gmail / Outlook
  const qrBuffer = await QRCode.toBuffer(`${APP_URL}/reservation/${r.id}`, {
    width: 260, margin: 2, errorCorrectionLevel: 'M',
    color: { dark: '#000000', light: '#ffffff' }
  });
  const prestDetails = parsePrestationsFromNotes(r.notes);
  const prestQrBuffers = await Promise.all(
    prestDetails.map((_, i) =>
      QRCode.toBuffer(`${APP_URL}/reservation/${r.id}?course=${i + 2}`, {
        width: 200, margin: 2, errorCorrectionLevel: 'M',
        color: { dark: '#000000', light: '#ffffff' }
      })
    )
  );

  const qrCid = 'qr_main';
  const prestQrCids = prestDetails.map((_, i) => `qr_course_${i + 2}`);
  const html = buildClientConfirmationHtml(
    r,
    `cid:${qrCid}`,
    prestDetails,
    prestQrCids.map(c => `cid:${c}`)
  );
  const subject = r.lang === 'en'
    ? `IsmaDrive — Booking confirmed · Ref. ${r.ref || r.id}`
    : `IsmaDrive — Réservation confirmée · Réf. ${r.ref || r.id}`;

  const attachments = [
    { content: qrBuffer, filename: 'qr-reservation.png', inlineContentId: qrCid, contentType: 'image/png' },
    ...prestQrBuffers.map((buf, i) => ({
      content: buf,
      filename: `qr-course-${i + 2}.png`,
      inlineContentId: prestQrCids[i],
      contentType: 'image/png'
    }))
  ];

  const payload = { from: RESEND_FROM, to: email, subject, html, attachments };
  if (RESEND_BCC_EMAIL && RESEND_BCC_EMAIL.toLowerCase() !== email.toLowerCase()) {
    payload.bcc = [RESEND_BCC_EMAIL];
  }

  const { error } = await resendEmailsSend(payload);
  if (error) {
    throw new Error(error.message || JSON.stringify(error));
  }

  if (r.id) {
    await dbUpdateRes(r.id, { confirmationEmailSent: true }).catch(e =>
      console.error('[Resend] confirmationEmailSent DB:', e.message)
    );
  }
  return { ok: true };
}

/* ── EMAIL AVIS CLIENT ── */
function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function formatNotesHtml(notes, accentColor) {
  if (!notes) return '';
  const color = accentColor || '#c9a96e';
  const blocks = [];
  const clean = notes.replace(/\[Prestation \d+:[^\]]*\]/g, m => { blocks.push(m); return ''; }).trim();
  let html = '';
  blocks.forEach(b => {
    const inner = b.slice(1, -1);
    const colon = inner.indexOf(':');
    const label = colon > -1 ? inner.slice(0, colon).trim() : 'Prestation';
    const detail = colon > -1 ? inner.slice(colon + 1).trim() : inner;
    html += `<div style="margin-top:8px;padding:8px 10px;background:#fffbf2;border-left:3px solid ${color};font-size:.82rem"><strong style="color:${color}">${escHtml(label)}</strong><br><span style="color:#555">${escHtml(detail)}</span></div>`;
  });
  if (clean) html += `<div style="margin-top:8px;font-size:.83rem;color:#555">${escHtml(clean)}</div>`;
  return html;
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
  const parts = detail.split(' · ').map(p => p.trim());
  const dateTimeIdx = parts.findIndex(p => /^\d{4}-\d{2}-\d{2}/.test(p));
  const raw = dateTimeIdx > -1 ? parts[dateTimeIdx] : '';
  const date = raw.substring(0, 10);
  const time = raw.length > 10 ? raw.substring(11, 16) : '';
  const priceMatch = detail.match(/(\d+)€/);
  const price = priceMatch ? priceMatch[1] : '—';
  const dirIdx = parts.findIndex(p => p === 'Depuis aéroport' || p === 'Vers aéroport');
  const dir = dirIdx > -1 ? parts[dirIdx] : '';
  const addr = dirIdx > -1 && dirIdx + 1 < parts.length ? parts[dirIdx + 1] : '';
  const routeEnd = dirIdx > -1 ? dirIdx : (dateTimeIdx > -1 ? dateTimeIdx : parts.length);
  const route = parts.slice(0, routeEnd).join(' · ');
  const dep = dir === 'Depuis aéroport' ? route : addr;
  const arr = dir === 'Depuis aéroport' ? addr : route;
  return { date, time, price, route, addr, dir, dep, arr };
}

async function buildReviewQrDataUrl() {
  return QRCode.toDataURL(GOOGLE_REVIEWS_URL, {
    width: 280, margin: 1, errorCorrectionLevel: 'M',
    type: 'image/png', color: { dark: '#000000', light: '#ffffff' }
  });
}

function buildReviewEmailHtml(r, qrDataUrl) {
  if (r.lang === 'en') return buildReviewEmailHtmlEN(r, qrDataUrl);
  const client = escHtml(r.client || 'cher client');
  const ref = escHtml(r.ref || r.id || '');
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
  <p style="margin:16px 0 0;font-size:13px;line-height:1.65;color:#555">Une question ? Répondez à cet email ou contactez-nous sur <a href="https://wa.me/33623889717" style="color:#8a7348">WhatsApp (+33 6 23 88 97 17)</a>.</p>
  <p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#999">À très bientôt,<br/>L'équipe IsmaDrive</p>
</td></tr>
<tr><td style="background:#fafafa;border-top:1px solid #eee;padding:14px 28px;text-align:center">
  <div style="font-size:11px;color:#aaa">Réf. ${ref} · © IsmaDrive · <a href="https://ismadrive.fr" style="color:#c9a96e;text-decoration:none">ismadrive.fr</a></div>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function buildReviewEmailHtmlEN(r, qrDataUrl) {
  const client = escHtml(r.client || 'valued customer');
  const ref = escHtml(r.ref || r.id || '');
  const reviewUrl = escHtml(GOOGLE_REVIEWS_URL);
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"></head>
<body style="margin:0;background:#f4f4f4;font-family:Arial,sans-serif;color:#333">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:4px;overflow:hidden;border:1px solid #e8e8e8">
<tr><td style="background:#080808;padding:22px 28px;border-bottom:2px solid #c9a96e">
  <div style="font-family:Georgia,serif;font-size:1.45rem;color:#c9a96e;letter-spacing:.08em">IsmaDrive</div>
  <div style="font-size:.72rem;color:#9a9185;letter-spacing:.18em;text-transform:uppercase;margin-top:4px">Thank you for your trust</div>
</td></tr>
<tr><td style="padding:28px 28px 20px">
  <p style="margin:0 0 14px;font-size:15px;line-height:1.6">Hello ${client},</p>
  <p style="margin:0 0 14px;font-size:14px;line-height:1.65;color:#444">Thank you for travelling with IsmaDrive. We hope your ride went smoothly.</p>
  <p style="margin:0 0 20px;font-size:14px;line-height:1.65;color:#555">Your Google review helps other travellers find us. It only takes 30 seconds.</p>
  <div style="text-align:center;padding:24px 0 16px;border:1px solid #f0ece4;border-radius:4px;background:#fffbf5;margin-bottom:20px">
    <img src="${qrDataUrl}" width="180" height="180" alt="IsmaDrive Google review QR code" style="display:inline-block;border:1px solid #e8e0d0;border-radius:4px"/>
    <p style="margin:12px 0 4px;font-size:11px;color:#bbb;letter-spacing:.1em;text-transform:uppercase">Scan to leave a review</p>
    <a href="${reviewUrl}" style="display:inline-block;margin-top:14px;background:#080808;color:#c9a96e;padding:11px 28px;text-decoration:none;font-size:13px;font-weight:500;letter-spacing:.1em;text-transform:uppercase;border:1px solid #c9a96e;border-radius:2px">Leave a Google review →</a>
  </div>
  <p style="margin:16px 0 0;font-size:13px;line-height:1.65;color:#555">A question? Reply to this email or contact us on <a href="https://wa.me/33623889717" style="color:#8a7348">WhatsApp (+33 6 23 88 97 17)</a>.</p>
  <p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#999">See you soon,<br/>The IsmaDrive team</p>
</td></tr>
<tr><td style="background:#fafafa;border-top:1px solid #eee;padding:14px 28px;text-align:center">
  <div style="font-size:11px;color:#aaa">Ref. ${ref} · © IsmaDrive · <a href="https://ismadrive.fr" style="color:#c9a96e;text-decoration:none">ismadrive.fr</a></div>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

async function sendReviewEmail(r) {
  const email = String(r.email || '').trim();
  if (!email || !GOOGLE_REVIEWS_URL) return;
  const qrDataUrl = await buildReviewQrDataUrl();
  const html = buildReviewEmailHtml(r, qrDataUrl);
  const reviewSubject = r.lang === 'en'
    ? `IsmaDrive — Thank you for your trust · Ref. ${r.ref || r.id}`
    : `IsmaDrive — Merci pour votre confiance · Réf. ${r.ref || r.id}`;
  const { error } = await resendEmailsSend({ from: RESEND_FROM, to: email, subject: reviewSubject, html });
  if (error) console.error('[Resend] Email avis:', error.message || error);
}

/* ── Telegram + email admin : paiement confirmé (même corps de message) ── */
function tgPlain(s, maxLen) {
  return String(s == null ? '' : s)
    .replace(/\r?\n/g, ' ')
    .slice(0, maxLen || 200);
}

/** Texte identique à celui envoyé sur Telegram (limite Telegram ~4k). */
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

async function notifyAdminEmailPayment(r, sourceTag) {
  const to = ADMIN_PAYMENT_NOTIFY_EMAIL;
  if (!to || !RESEND_API_KEY || !RESEND_FROM_EMAIL) return;

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

  const { error } = await resendEmailsSend({ from: RESEND_FROM, to, subject, html, text: plain });
  if (error) console.error('[Resend] admin paiement:', error.message || error);
}

async function notifyAdminTelegramCancellation(r, refundAmount, tier) {
  const token  = String(process.env.TELEGRAM_BOT_TOKEN   || '').trim();
  const chatId = String(process.env.TELEGRAM_ADMIN_CHAT_ID || '').trim();
  if (!token || !chatId) return;
  const tierLabel = tier === 'full' ? 'Remboursement intégral' : tier === 'half' ? 'Remboursement 50%' : 'Aucun remboursement';
  const text = [
    '🚫 Annulation client — IsmaDrive',
    '',
    `Réf: ${r.ref || r.id}`,
    `Client: ${r.client || '—'}`,
    `Tél: ${r.tel || '—'}`,
    `Trajet: ${r.trajet || '—'}`,
    `Quand: ${r.date || '—'} · ${r.time || '—'}`,
    `Remboursement: ${refundAmount} € (${tierLabel})`,
  ].join('\n').slice(0, 3900);
  const url = 'https://api.telegram.org/bot' + token + '/sendMessage';
  const ac  = new AbortController();
  const t   = setTimeout(() => ac.abort(), 12000);
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }), signal: ac.signal });
    if (!res.ok) console.error('[Telegram] annulation HTTP', res.status);
  } catch (e) {
    console.error('[Telegram] annulation:', e.message || e);
  } finally { clearTimeout(t); }
}

async function sendCancellationClientEmail(r, refundAmount, tier) {
  const email = String(r.email || '').trim();
  if (!email || !RESEND_API_KEY || !RESEND_FROM_EMAIL) return;
  const ref  = escHtml(r.ref || r.id || '');
  const lang = r.lang === 'en';
  const tierMsg = lang
    ? (tier === 'full'  ? `Full refund of <strong>${refundAmount} €</strong> — visible within 5–10 business days.`
      : tier === 'half' ? `Partial refund of <strong>${refundAmount} €</strong> (50%) — visible within 5–10 business days.`
      : 'No refund applicable (cancellation less than 12h before the trip).')
    : (tier === 'full'  ? `Remboursement intégral de <strong>${refundAmount} €</strong> — visible sous 5 à 10 jours ouvrés.`
      : tier === 'half' ? `Remboursement partiel de <strong>${refundAmount} €</strong> (50%) — visible sous 5 à 10 jours ouvrés.`
      : 'Aucun remboursement applicable (annulation moins de 12h avant la course).');
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:24px 0"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:4px;border:1px solid #e8e8e8">
<tr><td style="background:#080808;padding:24px 32px;border-bottom:2px solid #c9a96e">
  <div style="font-family:Georgia,serif;font-size:1.4rem;color:#c9a96e">IsmaDrive</div>
  <div style="font-size:.65rem;color:#9a9185;text-transform:uppercase;letter-spacing:.2em;margin-top:4px">${lang ? 'Booking cancellation' : 'Annulation de réservation'}</div>
</td></tr>
<tr><td style="padding:28px 32px">
  <p style="margin:0 0 16px;font-size:15px">${lang ? 'Your booking' : 'Votre réservation'} <strong style="font-family:monospace">${ref}</strong> ${lang ? 'has been cancelled.' : 'a bien été annulée.'}</p>
  <p style="margin:0 0 16px;font-size:14px;color:#555">${tierMsg}</p>
  <p style="margin:0;font-size:13px;color:#888">${lang ? 'Questions?' : 'Une question ?'} <a href="https://wa.me/33623889717" style="color:#c9a96e">WhatsApp +33 6 23 88 97 17</a></p>
</td></tr>
<tr><td style="background:#f9f9f9;border-top:1px solid #eee;padding:12px 32px;text-align:center">
  <div style="font-size:11px;color:#aaa">IsmaDrive · <a href="https://ismadrive.fr" style="color:#c9a96e;text-decoration:none">ismadrive.fr</a></div>
</td></tr>
</table></td></tr></table></body></html>`;
  const subject = lang
    ? `IsmaDrive — Booking cancelled · Ref. ${r.ref || r.id}`
    : `IsmaDrive — Réservation annulée · Réf. ${r.ref || r.id}`;
  const payload = { from: RESEND_FROM, to: email, subject, html };
  if (RESEND_BCC_EMAIL && RESEND_BCC_EMAIL.toLowerCase() !== email.toLowerCase()) payload.bcc = [RESEND_BCC_EMAIL];
  const { error } = await resendEmailsSend(payload);
  if (error) console.error('[Resend] cancellation client email:', error.message || error);
}

/* ── STRIPE WEBHOOK (raw body — doit être avant express.json()) ── */
app.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) return res.status(500).json({ error: 'STRIPE_WEBHOOK_SECRET manquant' });

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature invalide:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const reservationId = session.metadata?.reservationId;
    if (reservationId) {
      const before = await dbGetRes(reservationId).catch(() => null);
      const alreadyPaidThisSession =
        before &&
        before.paymentStatus === 'paid' &&
        before.stripeSessionId === session.id;
      const updates = { status: 'confirmed', paymentStatus: 'paid', stripeSessionId: session.id, stripePaymentIntentId: session.payment_intent || null, paidAt: new Date().toISOString() };
      await dbUpdateRes(reservationId, updates).catch(e => console.error('DB update error:', e.message));
      const r = await dbGetRes(reservationId).catch(() => null);
      console.log(`✅ Paiement confirmé pour réservation ${reservationId}`);
      if (r) {
        if (!alreadyPaidThisSession) {
          await notifyAdminTelegramPayment(r, 'stripe_webhook').catch(e =>
            console.error('[Telegram] admin notify:', e.message)
          );
          await notifyAdminEmailPayment(r, 'stripe_webhook').catch(e =>
            console.error('[Resend] admin paiement notify:', e.message)
          );
        }
        const sessionEmail = session.customer_email || session.customer_details?.email;
        let rowForEmail = r;
        const resolvedClientEmail = String(r.email || sessionEmail || '').trim();
        if (resolvedClientEmail && !r.email) {
          await dbUpdateRes(reservationId, { email: resolvedClientEmail }).catch(() => {});
          rowForEmail = { ...r, email: resolvedClientEmail };
        }
        if (rowForEmail.confirmationEmailSent !== true) {
          await sendClientConfirmationEmail(rowForEmail).catch(e =>
            console.error('Confirmation email error:', e.message)
          );
        }
      }
    }
  }

  res.json({ received: true });
});

/* ── MIDDLEWARE ── */
app.use(express.json());

/* ── Secours email : si le webhook Stripe n'a pas été reçu, la page succès envoie session_id ── */
app.post('/api/sync-booking-after-payment', async (req, res) => {
  const sessionId = String(req.body?.sessionId || '').trim();
  if (!sessionId) return res.status(400).json({ ok: false, error: 'sessionId requis' });
  if (!process.env.STRIPE_SECRET_KEY) return res.status(503).json({ ok: false, error: 'Stripe non configuré' });

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid') {
      return res.json({ ok: false, reason: 'payment_not_completed' });
    }

    const reservationId = session.metadata?.reservationId;
    if (!reservationId) return res.json({ ok: false, reason: 'no_reservation_in_session' });

    let r = await dbGetRes(reservationId);
    if (!r) return res.status(404).json({ ok: false, error: 'reservation_introuvable' });
    /* Relecture : le webhook Stripe peut avoir confirmé entre-temps → évite un 2e Telegram */
    r = (await dbGetRes(reservationId)) || r;

    const paidNow = new Date().toISOString();
    let transitionedToPaid = false;
    if (r.paymentStatus !== 'paid') {
      transitionedToPaid = true;
      await dbUpdateRes(reservationId, {
        status: 'confirmed',
        paymentStatus: 'paid',
        stripeSessionId: session.id,
        paidAt: r.paidAt || paidNow
      });
      r = await dbGetRes(reservationId);
    }

    if (transitionedToPaid && r) {
      await notifyAdminTelegramPayment(r, 'sync_apres_paiement').catch(e =>
        console.error('[Telegram] admin notify:', e.message)
      );
      await notifyAdminEmailPayment(r, 'sync_apres_paiement').catch(e =>
        console.error('[Resend] admin paiement notify:', e.message)
      );
    }

    /* Fallback : si r.email absent en DB, utilise customer_email du session Stripe */
    const resolvedEmail = String(r.email || session.customer_email || '').trim();
    if (resolvedEmail && !r.email) {
      await dbUpdateRes(reservationId, { email: resolvedEmail }).catch(() => {});
      r = { ...r, email: resolvedEmail };
    }

    const needsEmail = resolvedEmail && r.confirmationEmailSent !== true;
    if (needsEmail) {
      await sendClientConfirmationEmail(r);
      return res.json({ ok: true, emailSent: true });
    }

    return res.json({ ok: true, emailSent: false, reason: 'already_sent_or_no_email' });
  } catch (e) {
    console.error('sync-booking-after-payment:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

/* ── STRIPE CHECKOUT SESSION ── */
app.post('/api/create-checkout-session', async (req, res) => {
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({ error: 'Stripe non configuré — ajoutez STRIPE_SECRET_KEY dans vos variables d\'environnement.' });
  }
  const { date, time, durationMin, price, trajet, email } = req.body;
  const conflict = await checkConflict(date, time, Number(durationMin) || 60);
  if (conflict) return res.status(409).json({ error: 'Créneau indisponible', conflict });

  const consentTimestamp = req.body.consentTimestamp || new Date().toISOString();
  const policyVersion    = req.body.policyVersion    || '2025.05';

  let finalId  = crypto.randomBytes(8).toString('hex').toUpperCase();
  let finalRef = generateResRef();
  let insertErr = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      finalId  = crypto.randomBytes(8).toString('hex').toUpperCase();
      finalRef = generateResRef();
      console.warn('[DB] conflict 23505 tentative %d — nouvel id/ref générés', attempt + 1);
    }
    const newRes = { ...req.body, id: finalId, ref: finalRef, status: 'pending_payment', paymentStatus: 'unpaid', createdAt: new Date().toISOString(), consentTimestamp, policyVersion, cancellationToken: crypto.randomBytes(32).toString('hex') };
    try {
      await dbInsertRes(newRes);
      insertErr = null;
      break;
    } catch (err) {
      insertErr = err;
      if (err.pgCode !== '23505') break;
    }
  }

  if (insertErr) {
    const httpStatus = insertErr.supabaseStatus || 500;
    console.error('[DB] insert error status=%s code=%s detail=%s msg=%s', httpStatus, insertErr.pgCode, insertErr.pgDetail, insertErr.message);
    return res.status(httpStatus).json({
      error: 'Erreur base de données : ' + insertErr.message,
      pgCode: insertErr.pgCode,
      pgDetail: insertErr.pgDetail,
      pgHint: insertErr.pgHint,
      supabaseStatus: httpStatus,
    });
  }

  const lang = req.body.lang || 'fr';
  try {
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
      success_url: `${APP_URL}/payment-success?ref=${encodeURIComponent(finalRef)}&session_id={CHECKOUT_SESSION_ID}&lang=${encodeURIComponent(lang)}`,
      cancel_url: `${APP_URL}/?cancelled=1`,
      metadata: { reservationId: finalId },
    });

    res.json({ url: session.url, id: finalId });
  } catch (err) {
    console.error('Stripe error:', err.message);
    res.status(500).json({ error: 'Erreur Stripe : ' + err.message });
  }
});

/* ── API : VÉRIFICATION DISPONIBILITÉ ── */
app.post('/api/check-availability', async (req, res) => {
  const { date, time, durationMin, excludeId } = req.body;
  if (!date || !time) return res.json({ available: true });
  const conflict = await checkConflict(date, time, durationMin || 60, excludeId);
  if (conflict) {
    const next = await nextSlot(date, durationMin || 60, time);
    return res.json({
      available: false,
      conflict: { ref: conflict.ref, trajet: conflict.trajet, time: conflict.time },
      nextSlot: next,
    });
  }
  res.json({ available: true });
});

/* ── API : DISPONIBILITÉ JOURNÉE ── */
app.get('/api/availability', async (req, res) => {
  const { date } = req.query;
  if (!date) return res.json({ slots: [] });
  const dayRes = await dbListResByDate(date);
  const slots  = dayRes.map(r => ({
    startMin: timeToMin(r.time),
    endMin:   timeToMin(r.time) + Number(r.durationMin || 60) + BUFFER_MIN,
  }));
  res.json({ date, slots });
});

/* ── API : SAUVEGARDER RÉSERVATION ── */
app.post('/api/reservations', async (req, res) => {
  const { date, time, durationMin } = req.body;
  const conflict = await checkConflict(date, time, durationMin || 60);
  if (conflict) return res.status(409).json({ error: 'Créneau indisponible', conflict });
  const id  = crypto.randomBytes(8).toString('hex').toUpperCase();
  const ref = generateResRef();
  const newRes = { ...req.body, id, ref, createdAt: new Date().toISOString() };
  await dbInsertRes(newRes);
  res.json({ ok: true, id, ref, urlValidation: `${APP_URL}/reservation/${id}` });
});

/* ── ADMIN : lire réservations ── */
app.get('/api/reservations', async (req, res) => {
  if (req.query.pwd !== ADMIN_PWD) return res.status(401).json({ error: 'Non autorisé' });
  try { res.json(await dbListRes()); } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── ADMIN : ajouter manuellement ── */
app.post('/api/reservations/manual', async (req, res) => {
  const { pwd, ...data } = req.body;
  if (pwd !== ADMIN_PWD) return res.status(401).json({ error: 'Non autorisé' });
  const conflict = await checkConflict(data.date, data.time, data.durationMin || 60);
  if (conflict) return res.status(409).json({ error: 'Créneau indisponible', conflict });
  const id  = crypto.randomBytes(8).toString('hex').toUpperCase();
  const newRes = { ...data, id, status: 'confirmed', source: 'manual', createdAt: new Date().toISOString() };
  await dbInsertRes(newRes);
  res.json({ ok: true, id });
});

/* ── ADMIN : mettre à jour le statut ── */
app.patch('/api/reservations/:id', async (req, res) => {
  const { pwd, ...updates } = req.body;
  if (pwd !== ADMIN_PWD) return res.status(401).json({ error: 'Non autorisé' });
  const previous = await dbGetRes(req.params.id);
  if (!previous) return res.status(404).json({ error: 'Introuvable' });
  await dbUpdateRes(req.params.id, updates);

  if (updates.status === 'done' && previous.status !== 'done') {
    const updated = { ...previous, ...updates };
    sendReviewEmail(updated).catch(e => console.error('Review email error:', e.message));
  }

  res.json({ ok: true });
});

/* ── CONDUCTEURS : lire ── */
app.get('/api/drivers', async (req, res) => {
  if (req.query.pwd !== ADMIN_PWD) return res.status(401).json({ error: 'Non autorisé' });
  try { res.json(await dbListDrivers()); } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── CONDUCTEURS : ajouter ── */
app.post('/api/drivers', async (req, res) => {
  const { pwd, name, phone, email, carCategory, immatriculation } = req.body;
  if (pwd !== ADMIN_PWD) return res.status(401).json({ error: 'Non autorisé' });
  if (!name || !email) return res.status(400).json({ error: 'Nom et email requis' });
  await dbInsertDriver({ id: Date.now().toString(36), name, phone: phone || '', email, carCategory: carCategory || '', immatriculation: immatriculation || '' });
  res.json({ ok: true });
});

/* ── CONDUCTEURS : modifier ── */
app.put('/api/drivers/:id', async (req, res) => {
  const { pwd, name, phone, email, carCategory, immatriculation } = req.body;
  if (pwd !== ADMIN_PWD) return res.status(401).json({ error: 'Non autorisé' });
  if (!name || !email) return res.status(400).json({ error: 'Nom et email requis' });
  await dbUpdateDriver(req.params.id, { name, phone: phone || '', email, carCategory: carCategory || '', immatriculation: immatriculation || '' });
  res.json({ ok: true });
});

/* ── CONDUCTEURS : supprimer ── */
app.delete('/api/drivers/:id', async (req, res) => {
  const { pwd } = req.body;
  if (pwd !== ADMIN_PWD) return res.status(401).json({ error: 'Non autorisé' });
  await dbDeleteDriver(req.params.id);
  res.json({ ok: true });
});

/* ── ENVOI EMAIL CONDUCTEUR ── */
app.post('/api/send-driver-email', async (req, res) => {
  const { pwd, tripId, driverEmail, driverName, driverPrice, driverPlate, courseIndex } = req.body;
  if (pwd !== ADMIN_PWD) return res.status(401).json({ error: 'Non autorisé' });
  const to = String(driverEmail || '').trim();
  if (!to) return res.status(400).json({ error: 'Email du destinataire requis.' });
  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL) {
    return res.status(503).json({ error: 'Email non configuré : ajoutez RESEND_API_KEY et RESEND_FROM_EMAIL sur le serveur (Vercel).' });
  }
  const r = await dbGetRes(tripId);
  if (!r) return res.status(404).json({ error: 'Course introuvable' });

  const { applyCourseToReservation, parsePrestationsFromNotes } = require('../lib/booking-courses');
  const { buildDriverAssignmentsPatch, reservationViewForCourse } = require('../lib/driver-course-assignments');
  const cIdx = Math.max(0, parseInt(String(courseIndex ?? 0), 10) || 0);
  const prests = parsePrestationsFromNotes(r.notes);
  if (cIdx > 0 && !prests[cIdx - 1]) {
    return res.status(400).json({ error: `Course ${cIdx + 1} introuvable.` });
  }
  const courseNum = cIdx + 1;
  const rForEmail = reservationViewForCourse(r, courseNum, applyCourseToReservation);

  const formDriverName = String(driverName || '').trim();
  const formPlate = String(driverPlate || '').trim();
  /* Toujours croiser l'annuaire : le nom peut être saisi à la main sans la plaque, ou l'inverse. */
  const driverDirMatch = await dbGetDriverByEmail(to);
  const dirName = String(driverDirMatch?.name || '').trim();
  const dirPlate = String(driverDirMatch?.immatriculation || '').trim();
  const nm = formDriverName || dirName;
  const pl = formPlate || dirPlate;
  const assignedDisplay = (nm || emailLocalPart(to) || to).slice(0, 200);

  const token      = missionToken(tripId);
  const missionUrl = courseNum > 1
    ? `${APP_URL}/mission-order/${tripId}?token=${token}&course=${courseNum}`
    : `${APP_URL}/mission-order/${tripId}?token=${token}`;
  let qrDataUrl;
  try {
    qrDataUrl = await QRCode.toDataURL(missionUrl, {
      width: 200, margin: 2, errorCorrectionLevel: 'M',
      type: 'image/png', color: { dark: '#000000', light: '#ffffff' }
    });
  } catch (e) {
    console.error('[send-driver-email] QR:', e.message);
    qrDataUrl = '';
  }
  /* Email : nom « humain » (pas seulement la partie locale mail si on a un vrai nom) + plaque fusionnée */
  const nameForEmail = (nm || assignedDisplay).trim();
  const html = buildDriverEmailHtml(rForEmail, nameForEmail, missionUrl, driverPrice, qrDataUrl, pl, to);
  const whoLabel = assignedDisplay.slice(0, 48);
  const subject = `Course IsmaDrive — ${fmtDateFr(rForEmail.date)} à ${rForEmail.time} — ${whoLabel}`;

  try {
    const { error } = await resendEmailsSend({ from: RESEND_FROM, to, subject, html });
    if (error) {
      return res.status(500).json({ error: 'Erreur Resend : ' + (error.message || JSON.stringify(error)) });
    }
  } catch (e) {
    console.error('[send-driver-email] Resend:', e);
    return res.status(500).json({ error: 'Erreur envoi : ' + e.message });
  }

  /* Après envoi réussi : horodatage + destinataire + conducteur assigné (écrase l'ancien pour refléter le collègue) */
  const postEmail = buildDriverAssignmentsPatch(r, courseNum, {
    sentAt: new Date().toISOString(),
    sentTo: to,
    driverName: assignedDisplay,
    plate: pl,
  });
  try {
    await dbUpdateRes(tripId, postEmail);
  } catch (e) {
    console.error('[send-driver-email] DB réservation (bon / conducteur assigné):', e.message);
  }
  /* N'ajoute à l'annuaire que si on a un vrai nom (formulaire ou fiche conducteur), pas le pseudo-email seul. */
  const nameForDirectory = formDriverName || String(driverDirMatch?.name || '').trim();
  if (nameForDirectory) {
    try {
      await dbInsertDriver({
        id: Date.now().toString(36),
        name: nameForDirectory,
        email: to,
        phone: '',
        carCategory: '',
        immatriculation: pl || ''
      });
    } catch (e) {
      console.error('[send-driver-email] DB annuaire conducteur:', e.message);
    }
  }

  res.json({ ok: true, course: courseNum });
});

/* ── ORDRE DE MISSION (une course via ?course=N) ── */
app.get('/mission-order/:id', async (req, res) => {
  const r = await dbGetRes(req.params.id);
  if (!r) return res.status(404).send('Course introuvable');
  const expected = missionToken(req.params.id);
  if (req.query.token !== expected && req.query.pwd !== ADMIN_PWD)
    return res.status(403).send('Accès refusé');
  const { applyCourseToReservation, reservationUrl: bookingReservationUrl } = require('../lib/booking-courses');
  const { reservationViewForCourse } = require('../lib/driver-course-assignments');
  const courseNum = Math.max(1, parseInt(String(req.query.course || '1'), 10) || 1);
  const view = reservationViewForCourse(r, courseNum, applyCourseToReservation);
  const qrDataUrl = await QRCode.toDataURL(bookingReservationUrl(APP_URL, req.params.id, courseNum), {
    width: 260, margin: 2, errorCorrectionLevel: 'M',
    type: 'image/png', color: { dark: '#000000', light: '#ffffff' }
  });
  res.send(buildMissionOrderHtml(view, qrDataUrl));
});

/* ── PAGES ── */
app.get('/payment-success', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'payment-success.html')));
app.get('/admin', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

const pages = [
  'a-propos','faq','cgv','mentions-legales','confidentialite',
  'chauffeur-prive-versailles','chauffeur-prive-neuilly-sur-seine',
  'chauffeur-prive-boulogne-billancourt','vtc-la-defense','vtc-vincennes',
  'transfert-roissy-cdg','transfert-orly-paris',
  'cdg-airport-transfer-paris','orly-airport-transfer-paris',
];
pages.forEach(slug => {
  app.get(`/${slug}`, (_req, res) => res.sendFile(path.join(__dirname, 'public', `${slug}.html`)));
});

/* ══════════════════════════════════════════════════════════════
   PAGE PUBLIQUE — VALIDATION QR CLIENT
   ══════════════════════════════════════════════════════════════ */
function buildReservationValidationHtml(r) {
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

  const ref       = escHtml(r.ref || r.id || '');
  const dep       = escHtml(r.depLabel || (r.trajet || '').split(/[→>]/)[0]?.trim() || '—');
  const arr       = escHtml(r.arrLabel || (r.trajet || '').split(/[→>]/)[1]?.trim() || '—');
  const dateStr   = escHtml(fmtDateFr(r.date));
  const time      = escHtml(r.time || '—');
  const veh       = escHtml(vehicleDisplayName(r));
  const tel       = r.tel || '';
  const prix      = Number(r.price || 0);
  const ht        = (prix / 1.1).toFixed(2);
  const tva       = (prix - Number(ht)).toFixed(2);
  const ttc       = prix.toFixed(2);
  const nomAbrege = (r.client || '—').split(' ')
    .map((w, i) => i === 0 ? w[0] + '.' : w).join(' ');

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
.sec:last-child{border:none}
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
    <button onclick="window.print()" style="background:#1a7a3c;color:#fff;border:none;padding:11px 28px;font-size:.85rem;font-weight:bold;cursor:pointer;border-radius:6px;width:100%;font-family:Arial,sans-serif">⬇ Télécharger / Imprimer ce bon de commande</button>
    <div style="font-size:.68rem;color:#aaa;margin-top:8px">Sauvegarde en PDF via Imprimer → Enregistrer en PDF</div>
  </div>
  <div class="footer">Conforme arrêté du 6 août 2025 &nbsp;·&nbsp; IsmaDrive — Chauffeur Privé Paris &amp; Île-de-France</div>
</div>
<style>@media print{button{display:none}}</style>
</body></html>`;
}

/* ══════════════════════════════════════════════════════════════
   ADMIN — LISTE DES RÉSERVATIONS
   ══════════════════════════════════════════════════════════════ */
function buildAdminListHtml(reservations, search, pwd) {
  const today = new Date().toISOString().split('T')[0];
  const q     = (search || '').toLowerCase().trim();

  // Éclater chaque réservation en une carte par course (principale + prestations)
  const items = [];
  reservations.forEach(r => {
    const matchSearch = !q ||
      (r.ref    || '').toLowerCase().includes(q) ||
      (r.id     || '').toLowerCase().includes(q) ||
      (r.client || '').toLowerCase().includes(q);
    if (!matchSearch) return;

    // Course 1 — champs principaux de la réservation
    const showMain = q ? true : (r.date === today && r.status !== 'cancelled');
    if (showMain) {
      items.push({ r, date: r.date, time: r.time, trajet: r.trajet, price: r.price, courseIdx: null });
    }

    // Courses 2+ — extraites des notes
    const prestDetails = parsePrestationsFromNotes(r.notes);
    prestDetails.forEach((detail, i) => {
      const pf = parsePrestationFields(detail);
      const showPrest = q ? true : (pf.date === today && r.status !== 'cancelled');
      if (showPrest) {
        items.push({
          r,
          date:    pf.date  || r.date,
          time:    pf.time  || '',
          trajet:  pf.route || r.trajet,
          price:   pf.price ? Number(pf.price) : r.price,
          courseIdx: i + 2
        });
      }
    });
  });

  // Tri global par date puis heure
  items.sort((a, b) => {
    const da = (a.date || '') + 'T' + (a.time || '00:00');
    const db = (b.date || '') + 'T' + (b.time || '00:00');
    return da.localeCompare(db);
  });

  const cards = items.map(({ r, date, time, trajet, price, courseIdx }) => {
    const ref         = escHtml(r.ref || r.id || '');
    const statusColor = r.status === 'done' ? '#c9a96e' : r.status === 'cancelled' ? '#e05454' : '#27ae60';
    const statusLabel = r.status === 'done' ? 'Terminé' : r.status === 'cancelled' ? 'Annulé' : 'Confirmé';
    const collStrong  =
      String(r.assignedDriverName || '').trim() ||
      emailLocalPart(r.driverOrderSentTo) ||
      String(r.driverOrderSentTo || '').trim() ||
      '—';
    const courseBadge = courseIdx
      ? `<span style="background:#1a4a6a22;color:#1a4a6a;padding:1px 7px;border-radius:10px;font-size:.66rem;font-weight:bold;margin-left:6px">Course ${courseIdx}</span>`
      : '';
    const bonUrl = `/admin/reservations/${escHtml(r.id)}${pwd ? '?pwd=' + encodeURIComponent(pwd) : ''}`;
    return `<div style="background:#fff;border-radius:6px;padding:14px 16px;margin-bottom:10px;box-shadow:0 1px 8px rgba(0,0,0,.08);border-left:4px solid ${statusColor}">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
    <div style="display:flex;align-items:center"><span style="font-family:monospace;font-size:.82rem;color:#555">${ref}</span>${courseBadge}</div>
    <span style="background:${statusColor}22;color:${statusColor};padding:2px 8px;border-radius:12px;font-size:.72rem;font-weight:bold">${statusLabel}</span>
  </div>
  <div style="font-size:1rem;font-weight:bold;margin-bottom:4px">${escHtml(r.client || '—')}</div>
  ${r.tel ? `<div style="margin-bottom:4px"><a href="tel:${escHtml(r.tel)}" style="color:#c9a96e;text-decoration:none;font-size:.85rem">📞 ${escHtml(r.tel)}</a></div>` : ''}
  <div style="font-size:.83rem;color:#555;margin-bottom:2px">🕐 ${escHtml(time || '—')}${date && date !== today ? ' — ' + escHtml(fmtDateFr(date)) : ''}</div>
  <div style="font-size:.83rem;color:#555;margin-bottom:8px">📍 ${escHtml(trajet || '—')}</div>
  ${r.driverOrderSentAt ? `<div style="font-size:.78rem;color:#6a5f4a;margin-bottom:6px">✉ Collègue : <strong>${escHtml(collStrong)}</strong>${r.driverOrderSentTo ? ' <span style="color:#888">· ' + escHtml(r.driverOrderSentTo) + '</span>' : ''}</div>` : ''}
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
    <span style="font-size:.8rem;color:#888">${escHtml(vehicleDisplayName(r))}</span>
    <span style="font-weight:bold;color:#c9a96e">${Number(price || 0).toFixed(2)} €</span>
  </div>
  <a href="${bonUrl}" style="display:block;background:#080808;color:#c9a96e;text-align:center;padding:9px;text-decoration:none;font-size:.8rem;border-radius:4px;letter-spacing:.04em">Voir le bon complet →</a>
</div>`;
  }).join('');

  return `<!DOCTYPE html><html lang="fr"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Dashboard Chauffeur — IsmaDrive</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;background:#f0f0f0;min-height:100vh}
.hdr{background:#080808;padding:16px 20px;border-bottom:2px solid #c9a96e;display:flex;justify-content:space-between;align-items:center}
.logo{font-family:Georgia,serif;color:#c9a96e;font-size:1.3rem;letter-spacing:.1em}
.sub{font-size:.65rem;color:#9a9185;letter-spacing:.16em;text-transform:uppercase;margin-top:2px}
.search{padding:12px 16px;background:#fff;border-bottom:1px solid #eee}
.search input{width:100%;padding:10px 14px;border:1px solid #ddd;border-radius:6px;font-size:.9rem;outline:none}
.search input:focus{border-color:#c9a96e}
.date-lbl{padding:10px 16px;font-size:.7rem;color:#999;letter-spacing:.1em;text-transform:uppercase}
.content{padding:0 12px 24px}
.empty{text-align:center;padding:40px 20px;color:#999;font-size:.9rem}
</style></head><body>
<div class="hdr">
  <div>
    <div class="logo">IsmaDrive</div>
    <div class="sub">Dashboard Chauffeur</div>
  </div>
  <a href="/admin" style="color:#9a9185;text-decoration:none;font-size:.75rem;padding:6px 12px;border:1px solid #333;border-radius:3px">← Calendrier</a>
</div>
<div class="search">
  <form method="GET" action="/admin/reservations">
    <input type="text" name="q" value="${escHtml(q)}" placeholder="Rechercher par numéro RES ou nom client…" autofocus>
  </form>
</div>
<div class="date-lbl">${q ? `Résultats pour "${escHtml(q)}"` : `Courses du jour — ${fmtDateFr(today)}`} (${items.length})</div>
<div class="content">${items.length === 0 ? '<div class="empty">Aucune course trouvée</div>' : cards}</div>
</body></html>`;
}

/* ══════════════════════════════════════════════════════════════
   ADMIN — BON DE COMMANDE CHAUFFEUR
   ══════════════════════════════════════════════════════════════ */
function buildAdminBonHtml(r, pwd) {
  const ref         = escHtml(r.ref || r.id || '');
  const dep         = r.depLabel || (r.trajet || '').split(/[→>]/)[0]?.trim() || '';
  const arr         = r.arrLabel || (r.trajet || '').split(/[→>]/)[1]?.trim() || '';
  const dateStr     = escHtml(fmtDateFr(r.date));
  const veh         = escHtml(vehicleDisplayName(r));
  const statusColor = r.status === 'done' ? '#c9a96e' : r.status === 'cancelled' ? '#e05454' : '#27ae60';
  const statusLabel = r.status === 'done' ? 'TERMINÉ' : r.status === 'cancelled' ? 'ANNULÉ' : 'CONFIRMÉ';
  const depEnc      = encodeURIComponent(dep);
  const arrEnc      = encodeURIComponent(arr);
  const canAct      = r.status !== 'done' && r.status !== 'cancelled';
  const listUrl     = `/admin/reservations${pwd ? '?pwd=' + encodeURIComponent(pwd) : ''}`;
  const safePwd     = JSON.stringify(pwd || '');
  const safeId      = JSON.stringify(r.id || '');

  return `<!DOCTYPE html><html lang="fr"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Bon ${ref} — IsmaDrive</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;background:#f4f4f4;color:#333;padding:12px;min-height:100vh}
.card{max-width:560px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 14px rgba(0,0,0,.11)}
.card-head{background:#080808;padding:18px 22px;border-bottom:2px solid #c9a96e;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px}
.logo{font-family:Georgia,serif;font-size:1.4rem;color:#c9a96e;letter-spacing:.1em}
.badge{display:inline-block;padding:3px 10px;font-size:.68rem;text-transform:uppercase;letter-spacing:.1em;border-radius:2px;font-weight:bold}
.sec{padding:14px 20px;border-bottom:1px solid #eee}
.lbl{font-size:.63rem;color:#9a9185;text-transform:uppercase;letter-spacing:.14em;margin-bottom:3px}
.val{font-size:.92rem;color:#333}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.nav-links{margin-top:6px;font-size:.8rem}.nav-links a{color:#c9a96e;text-decoration:none;margin-right:14px}
.actions{padding:14px 20px;display:flex;gap:8px;flex-wrap:wrap;background:#fafafa;border-top:1px solid #eee}
.btn{padding:10px 18px;border:none;border-radius:4px;font-size:.82rem;font-weight:bold;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:5px}
.btn-done{background:#27ae60;color:#fff}
.btn-cancel{background:none;border:1px solid #e05454;color:#e05454}
.btn-back{background:none;border:1px solid #ccc;color:#555}
.btn-share{background:#080808;color:#c9a96e;border:1px solid #c9a96e;width:100%}
/* Panel collègue */
.share-panel{display:none;border-top:2px solid #c9a96e;background:#fafafa;padding:16px 20px}
.share-panel.open{display:block}
.sp-title{font-size:.68rem;text-transform:uppercase;letter-spacing:.16em;color:#9a9185;margin-bottom:12px}
.sp-field{margin-bottom:10px}
.sp-label{font-size:.72rem;color:#666;margin-bottom:4px;display:block}
.sp-input,.sp-select{width:100%;padding:9px 11px;border:1px solid #ddd;border-radius:4px;font-size:.88rem;font-family:Arial,sans-serif;background:#fff;color:#333;outline:none;transition:border-color .18s}
.sp-input:focus,.sp-select:focus{border-color:#c9a96e}
.sp-select{cursor:pointer}
.sp-or{text-align:center;font-size:.72rem;color:#aaa;margin:6px 0}
.sp-price{border-color:#c9a96e}
.sp-status{display:none;padding:9px 12px;border-radius:4px;font-size:.82rem;margin-bottom:10px;line-height:1.4}
.sp-status.ok{display:block;background:#e8f8ee;border:1px solid #a8ddb5;color:#1a7a3c}
.sp-status.err{display:block;background:#fef2f2;border:1px solid #fca5a5;color:#dc2626}
.sp-send{width:100%;padding:11px;background:#c9a96e;color:#000;border:none;border-radius:4px;font-size:.85rem;font-weight:bold;cursor:pointer;transition:background .18s}
.sp-send:hover{background:#e8c98a}
.sp-send:disabled{opacity:.55;cursor:not-allowed}
.bon-sent-notice{background:#fff8e6;border-bottom:1px solid #e8d39a;padding:12px 18px;font-size:.84rem;color:#4a3f12;line-height:1.55}
.bon-sent-notice strong{color:#2a2408}
.footer{padding:10px 20px;font-size:.65rem;color:#bbb;text-align:center;background:#f9f9f9;border-top:1px solid #eee}
@media(max-width:480px){.g2{grid-template-columns:1fr}.card-head{flex-direction:column;align-items:flex-start}}
@media print{body{background:#fff;padding:0}.card{box-shadow:none}.actions,.share-panel{display:none!important}}
</style></head><body>
<div class="card">
  <div class="card-head">
    <div class="logo">IsmaDrive</div>
    <div>
      <div style="font-size:.7rem;color:#9a9185;letter-spacing:.12em;text-transform:uppercase;margin-bottom:3px">Bon n° ${ref}</div>
      <span class="badge" style="background:${statusColor}22;color:${statusColor}">${statusLabel}</span>
    </div>
  </div>

  ${r.driverOrderSentAt ? `<div class="bon-sent-notice" id="bon-sent-banner" role="status">✉ <strong>Bon de commande déjà envoyé</strong> à <strong>${escHtml(r.driverOrderSentTo || '—')}</strong>${(r.assignedDriverName || '').trim() ? ' <strong>(' + escHtml((r.assignedDriverName || '').trim()) + ')</strong>' : ''} — <strong>${escHtml(fmtDateTimeFr(r.driverOrderSentAt))}</strong><br><span style="font-size:.76rem;color:#6a5f4a;font-weight:normal">Un nouvel envoi mettra à jour cette date (ex. autre collègue).</span></div>` : ''}

  <div class="sec">
    <div class="g2">
      <div><div class="lbl">Date</div><div class="val">${dateStr}</div></div>
      <div><div class="lbl">Heure prise en charge</div><div class="val">${escHtml(r.time || '—')}</div></div>
      <div><div class="lbl">Durée estimée</div><div class="val">${r.durationMin || 60} min</div></div>
      <div><div class="lbl">Véhicule</div><div class="val">${veh}</div></div>
    </div>
  </div>

  <div class="sec" style="border-left:3px solid #c9a96e">
    <div class="lbl">Adresse de départ</div>
    <div class="val" style="font-weight:bold;font-size:1rem;margin:4px 0">${escHtml(dep || '—')}</div>
    ${dep ? `<div class="nav-links"><a href="https://www.google.com/maps/dir/?api=1&destination=${depEnc}" target="_blank">📍 Google Maps</a><a href="https://waze.com/ul?q=${depEnc}&navigate=yes" target="_blank">🚗 Waze</a></div>` : ''}
  </div>

  <div class="sec" style="border-left:3px solid #6e9ac9">
    <div class="lbl">Adresse d'arrivée</div>
    <div class="val" style="font-weight:bold;font-size:1rem;margin:4px 0">${escHtml(arr || '—')}</div>
    ${arr ? `<div class="nav-links"><a href="https://www.google.com/maps/dir/?api=1&destination=${arrEnc}" target="_blank">📍 Google Maps</a><a href="https://waze.com/ul?q=${arrEnc}&navigate=yes" target="_blank">🚗 Waze</a></div>` : ''}
  </div>

  <div class="sec">
    <div class="g2">
      <div><div class="lbl">Client</div><div class="val">${escHtml(r.client || '—')}</div></div>
      <div><div class="lbl">Téléphone</div><div class="val"><a href="tel:${escHtml(r.tel || '')}" style="color:#c9a96e;text-decoration:none">${escHtml(r.tel || '—')}</a></div></div>
    </div>
    ${r.email ? `<div style="margin-top:10px"><div class="lbl">Email</div><div class="val" style="font-size:.85rem">${escHtml(r.email)}</div></div>` : ''}
    ${r.notes ? `<div style="margin-top:10px">${formatNotesHtml(r.notes, '#c9a96e')}</div>` : ''}
  </div>

  <div class="sec">
    <div class="g2">
      <div><div class="lbl">Exploitant</div><div class="val">${escHtml(EXPLOITANT.raisonSociale)}</div></div>
      <div><div class="lbl">N° REVTC</div><div class="val">${escHtml(EXPLOITANT.numeroREVTC)}</div></div>
      <div><div class="lbl">SIRET</div><div class="val">${escHtml(EXPLOITANT.siret)}</div></div>
      <div><div class="lbl">Téléphone</div><div class="val">${escHtml(EXPLOITANT.telephone)}</div></div>
    </div>
  </div>

  <div class="actions" style="flex-direction:column">
    ${canAct ? `
    <div style="display:flex;gap:8px;width:100%;flex-wrap:wrap">
      <form method="POST" action="/admin/reservations/${escHtml(r.id)}/done" style="margin:0;flex:1">
        <button type="submit" class="btn btn-done" style="width:100%">✓ Marquer comme terminée</button>
      </form>
      <form method="POST" action="/admin/reservations/${escHtml(r.id)}/cancel" style="margin:0" onsubmit="return confirm('Annuler cette réservation ?')">
        <button type="submit" class="btn btn-cancel">✕ Annuler</button>
      </form>
    </div>` : ''}
    <button class="btn btn-share" onclick="toggleShare()">
      <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 10l14-7-5 14-3-5-6-2z"/></svg>
      ${r.driverOrderSentAt ? 'Renvoyer à un collègue' : 'Envoyer à un collègue'}
    </button>
    <a href="${listUrl}" class="btn btn-back" style="justify-content:center">← Retour à la liste</a>
  </div>

  <!-- Panel envoi collègue -->
  <div class="share-panel" id="share-panel">
    <div class="sp-title">Envoyer ce bon à un collègue</div>

    <div class="sp-field">
      <label class="sp-label">Choisir dans l'annuaire</label>
      <select class="sp-select" id="sp-annuaire" onchange="onAnnuaireChange()">
        <option value="">— Chargement de l'annuaire… —</option>
      </select>
    </div>

    <div class="sp-or">ou saisir directement</div>

    <div class="sp-field">
      <label class="sp-label">Email du collègue *</label>
      <input class="sp-input" id="sp-email" type="email" placeholder="conducteur@exemple.com">
    </div>
    <div class="sp-field">
      <label class="sp-label">Prénom (optionnel)</label>
      <input class="sp-input" id="sp-name" type="text" placeholder="Prénom">
    </div>
    <div class="sp-field">
      <label class="sp-label">Immatriculation du véhicule</label>
      <input class="sp-input" id="sp-plate" type="text" placeholder="AA-123-BB" style="font-family:monospace;letter-spacing:.06em">
    </div>
    <div class="sp-field">
      <label class="sp-label">Prix à lui verser (€) *</label>
      <input class="sp-input sp-price" id="sp-price" type="number" min="0" placeholder="Ex : 60">
    </div>

    <div class="sp-status" id="sp-status"></div>
    <button class="sp-send" id="sp-send" onclick="sendToColleague()">✉ Envoyer le bon de commande</button>
  </div>

  <div class="footer">Conforme arrêté du 6 août 2025 &nbsp;·&nbsp; IsmaDrive — Chauffeur Privé Paris &amp; Île-de-France</div>
</div>

<script>
const _PWD = ${safePwd};
const _ID  = ${safeId};
let _driversLoaded = false;
const _ORDER_SENT_AT = ${JSON.stringify(r.driverOrderSentAt || null)};
const _ORDER_SENT_TO = ${JSON.stringify(r.driverOrderSentTo || null)};
const _ORDER_ASSIGNED_NAME = ${JSON.stringify(String(r.assignedDriverName || '').trim())};
function fmtOrderSentLabel() {
  if (!_ORDER_SENT_AT) return '';
  try {
    var d = new Date(_ORDER_SENT_AT);
    var when = isNaN(d.getTime()) ? String(_ORDER_SENT_AT) : d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
    return when + ' à ' + (_ORDER_SENT_TO || '?') + (_ORDER_ASSIGNED_NAME ? ' (' + _ORDER_ASSIGNED_NAME + ')' : '');
  } catch (e) { return String(_ORDER_SENT_AT); }
}

function parseJsonSafe(raw, httpStatus) {
  const t = String(raw == null ? '' : raw).trim();
  if (!t) return {};
  try { return JSON.parse(t); }
  catch (e) {
    const html = /^[\\s]*<(!DOCTYPE|html)/i.test(t);
    if (html) return { error: 'Réponse HTML (erreur serveur / Vercel). Consultez les logs. [HTTP ' + (httpStatus || '?') + ']' };
    if (/^An error occurred/i.test(t) || /^Application error/i.test(t))
      return { error: 'Erreur d'exécution serveur (Vercel). [HTTP ' + (httpStatus || '?') + ']' };
    return { error: 'Réponse non-JSON [HTTP ' + (httpStatus || '?') + ']' };
  }
}

function toggleShare() {
  const panel = document.getElementById('share-panel');
  panel.classList.toggle('open');
  if (panel.classList.contains('open') && !_driversLoaded) loadDrivers();
}

async function loadDrivers() {
  _driversLoaded = true;
  try {
    const r = await fetch('/api/drivers?pwd=' + encodeURIComponent(_PWD));
    const raw = await r.text();
    if (!r.ok) return;
    const drivers = parseJsonSafe(raw, r.status);
    if (!Array.isArray(drivers)) return;
    const sel = document.getElementById('sp-annuaire');
    sel.innerHTML = '<option value="">— Annuaire conducteurs —</option>';
    if (!drivers.length) {
      sel.innerHTML += '<option disabled>Aucun conducteur enregistré</option>';
      return;
    }
    drivers.forEach(d => {
      const opt = document.createElement('option');
      opt.value = JSON.stringify({ email: d.email, name: d.name || '', plate: d.immatriculation || '' });
      opt.textContent = d.name + (d.carCategory ? ' · ' + d.carCategory : '') + (d.immatriculation ? ' · ' + d.immatriculation : '') + (d.phone ? '  ' + d.phone : '');
      sel.appendChild(opt);
    });
  } catch(e) {
    document.getElementById('sp-annuaire').innerHTML = '<option value="">Erreur de chargement</option>';
  }
}

function onAnnuaireChange() {
  const val = document.getElementById('sp-annuaire').value;
  if (!val) return;
  try {
    const d = JSON.parse(val);
    document.getElementById('sp-email').value = d.email || '';
    document.getElementById('sp-name').value  = d.name  || '';
    document.getElementById('sp-plate').value = d.plate || '';
  } catch(e) {}
}

async function sendToColleague() {
  const email = document.getElementById('sp-email').value.trim();
  const name  = document.getElementById('sp-name').value.trim();
  const price = document.getElementById('sp-price').value.trim();
  const plate = document.getElementById('sp-plate').value.trim();
  const btn   = document.getElementById('sp-send');

  if (!email)                       { showStatus('err', 'Email du collègue requis'); return; }
  if (!price || isNaN(Number(price))) { showStatus('err', 'Indiquez le prix à verser'); return; }

  if (_ORDER_SENT_AT) {
    if (!confirm('Un bon de commande a déjà été envoyé le ' + fmtOrderSentLabel() + '.\n\nVoulez-vous vraiment renvoyer un email ?')) {
      btn.disabled = false;
      btn.textContent = '✉ Envoyer le bon de commande';
      return;
    }
  }

  btn.disabled = true;
  btn.textContent = 'Envoi en cours…';
  hideStatus();

  try {
    const res  = await fetch('/api/send-driver-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pwd: _PWD, tripId: _ID, driverEmail: email, driverName: name, driverPrice: Number(price), driverPlate: plate })
    });
    const raw = await res.text();
    const data = parseJsonSafe(raw, res.status);
    if (res.ok && data.ok) {
      showStatus('ok', '✅ Bon envoyé à ' + email);
      btn.textContent = '✓ Envoyé';
      btn.disabled = false;
      setTimeout(function () { window.location.reload(); }, 800);
    } else {
      showStatus('err', data.error || ('Erreur ' + res.status));
      btn.disabled = false;
      btn.textContent = '✉ Envoyer le bon de commande';
    }
  } catch(e) {
    showStatus('err', 'Erreur réseau : ' + e.message);
    btn.disabled = false;
    btn.textContent = '✉ Envoyer le bon de commande';
  }
}

function showStatus(type, msg) {
  const el = document.getElementById('sp-status');
  el.className = 'sp-status ' + type;
  el.textContent = msg;
}
function hideStatus() {
  const el = document.getElementById('sp-status');
  el.className = 'sp-status';
}
</script>
</body></html>`;
}

/* ══════════════════════════════════════════════════════════════
   NOUVELLES ROUTES
   ══════════════════════════════════════════════════════════════ */

/* Page publique : scan QR client → validation */
app.get('/reservation/:id', async (req, res) => {
  const r = await dbGetRes(req.params.id).catch(() => null);
  res.send(buildReservationValidationHtml(r));
});

/* QR code PNG standalone */
app.get('/api/reservations/:id/qrcode', async (req, res) => {
  const url = `${APP_URL}/reservation/${req.params.id}`;
  try {
    const png = await QRCode.toBuffer(url, { width: 300, margin: 2, errorCorrectionLevel: 'M' });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(png);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* Mise à jour statut (accept body.pwd ou Basic Auth) */
app.patch('/api/reservations/:id/statut', async (req, res) => {
  if (!checkAdminAuth(req)) return res.status(401).json({ error: 'Non autorisé' });
  const map = { 'terminé': 'done', 'annulé': 'cancelled', 'en cours': 'confirmed' };
  const s   = req.body.statut || req.body.status || '';
  const normalized = map[s] || s;
  if (!['done', 'cancelled', 'confirmed', 'pending_payment'].includes(normalized))
    return res.status(400).json({ error: 'Statut invalide' });
  await dbUpdateRes(req.params.id, { status: normalized });
  res.json({ ok: true });
});

/* Dashboard chauffeur — liste */
app.get('/admin/reservations', requireBasicAuth, async (req, res) => {
  const reservations = await dbListRes().catch(() => []);
  const pwd = req.query.pwd || '';
  res.send(buildAdminListHtml(reservations, req.query.q || '', pwd));
});

/* Dashboard chauffeur — bon de commande */
app.get('/admin/reservations/:id', requireBasicAuth, async (req, res) => {
  const r = await dbGetRes(req.params.id).catch(() => null);
  if (!r) return res.status(404).send('Réservation introuvable');
  const pwd = req.query.pwd || ADMIN_PWD;
  res.send(buildAdminBonHtml(r, pwd));
});

/* Marquer comme terminée (formulaire admin) */
app.post('/admin/reservations/:id/done', requireBasicAuth, async (req, res) => {
  const r = await dbGetRes(req.params.id).catch(() => null);
  if (r && r.status !== 'done') {
    await dbUpdateRes(req.params.id, { status: 'done' });
    sendReviewEmail({ ...r, status: 'done' }).catch(e => console.error('Review email:', e.message));
  }
  res.redirect('/admin/reservations/' + req.params.id);
});

/* Annuler (formulaire admin) */
app.post('/admin/reservations/:id/cancel', requireBasicAuth, async (req, res) => {
  await dbUpdateRes(req.params.id, { status: 'cancelled' }).catch(() => {});
  res.redirect('/admin/reservations');
});

/* ── ANNULATION CLIENT ── */
app.get('/api/cancel-info', async (req, res) => {
  const token = String(req.query.token || '').trim();
  if (!token) return res.status(400).json({ error: 'token_manquant', message: 'Token d\'annulation manquant.' });
  const r = await dbGetResByCancellationToken(token).catch(() => null);
  if (!r) return res.status(404).json({ error: 'token_invalide', message: 'Ce lien est invalide ou a expiré.' });
  if (r.status === 'cancelled') return res.status(410).json({ error: 'already_cancelled' });
  if (r.paymentStatus !== 'paid') return res.status(409).json({ error: 'payment_not_confirmed', message: 'Paiement non confirmé.' });
  const tier        = computeCancellationTier(r);
  const price       = Number(r.price || 0);
  const refundAmount = tier === 'full' ? price : tier === 'half' ? Math.round(price * 50) / 100 : 0;
  const dep = r.depLabel || (r.trajet || '').split(/[→>]/)[0]?.trim() || '—';
  const arr = r.arrLabel || (r.trajet || '').split(/[→>]/)[1]?.trim() || '—';
  res.json({ ref: r.ref || r.id, date: r.date, time: r.time, dep, arr, price, tier, refundAmount });
});

app.post('/api/cancel-reservation', async (req, res) => {
  const token = String(req.body?.token || '').trim();
  if (!token) return res.status(400).json({ error: 'token_manquant' });
  const r = await dbGetResByCancellationToken(token).catch(() => null);
  if (!r) return res.status(404).json({ error: 'token_invalide' });
  if (r.status === 'cancelled') return res.status(410).json({ error: 'already_cancelled' });
  if (r.paymentStatus !== 'paid') return res.status(409).json({ error: 'payment_not_confirmed' });

  const tier        = computeCancellationTier(r);
  const price       = Number(r.price || 0);
  const refundAmount = tier === 'full' ? price : tier === 'half' ? Math.round(price * 50) / 100 : 0;

  let stripeRefundId = null;
  let stripeError    = null;
  if (refundAmount > 0 && r.stripePaymentIntentId && process.env.STRIPE_SECRET_KEY) {
    try {
      const refund   = await stripe.refunds.create({ payment_intent: r.stripePaymentIntentId, amount: Math.round(refundAmount * 100) });
      stripeRefundId = refund.id;
    } catch (e) {
      stripeError = e.message;
      console.error('[Stripe] refund error:', e.message);
    }
  }

  await dbUpdateRes(r.id, { status: 'cancelled', cancelledAt: new Date().toISOString(), refundAmount, stripeRefundId }).catch(e =>
    console.error('[DB] cancel update:', e.message)
  );

  notifyAdminTelegramCancellation(r, refundAmount, tier).catch(() => {});
  sendCancellationClientEmail(r, refundAmount, tier).catch(() => {});

  res.json({ ok: true, tier, refundAmount, stripeRefundId, stripeError });
});

app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

// Pour Vercel, on exporte l'app au lieu de l'écouter
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`\n✅ Serveur démarré : http://localhost:${PORT}`);
    console.log(`   Admin    : http://localhost:${PORT}/admin`);
    console.log(`   Supabase : ${process.env.SUPABASE_URL ? '✅' : '❌ SUPABASE_URL manquant'}`);
    const resendOk = !!(RESEND_API_KEY && RESEND_FROM_EMAIL);
    console.log(`   Resend   : ${resendOk ? '✅' : '❌ RESEND_API_KEY ou RESEND_FROM_EMAIL manquant'}\n`);
  });
}

module.exports = app;
