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

/* ── SUPABASE ── */
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

/* ── CONFIG ── */
const ADMIN_PWD          = process.env.ADMIN_PWD || 'idvtc2024';
const BUFFER_MIN         = 0;
const APP_URL            = (process.env.APP_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const GOOGLE_REVIEWS_URL = process.env.GOOGLE_REVIEWS_URL || 'https://g.page/r/CWL4dJY-hj2oEAE/review';
const RESEND_API_KEY     = process.env.RESEND_API_KEY || '';
const RESEND_FROM_EMAIL  = process.env.RESEND_FROM_EMAIL || '';

/* ── DB HELPERS ── */
async function dbInsertRes(r) {
  const { error } = await supabase.from('reservations').insert(r);
  if (error) throw new Error(error.message);
}

async function dbListRes() {
  const { data, error } = await supabase.from('reservations').select('*').order('createdAt', { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

async function dbGetRes(id) {
  const { data } = await supabase.from('reservations').select('*').eq('id', id).single();
  return data || null;
}

async function dbUpdateRes(id, updates) {
  const { error } = await supabase.from('reservations').update(updates).eq('id', id);
  if (error) throw new Error(error.message);
}

async function dbListResByDate(date) {
  const { data } = await supabase.from('reservations').select('*').eq('date', date).neq('status', 'cancelled');
  return data || [];
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

async function checkConflict(date, time, durationMin, excludeId = null) {
  const newStart = timeToMin(time);
  const newEnd   = newStart + Number(durationMin) + BUFFER_MIN;
  const dayRes   = (await dbListResByDate(date)).filter(r => r.id !== excludeId);
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
  const driverName = 'ISMA';
  const plate = r.vehicle === 'van' ? 'FT-365-XH' : '';

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
  <div class="section" style="background:#fffbf2;border-left:3px solid #c9a96e">
    <div style="font-size:.63rem;color:#9a9185;text-transform:uppercase;letter-spacing:.15em;margin-bottom:10px">Votre chauffeur</div>
    <div class="grid2">
      <div>
        <div class="lbl">Prénom</div>
        <div class="val" style="font-size:1.15rem;font-weight:bold;color:#080808">${driverName}</div>
      </div>
      ${plate ? `<div>
        <div class="lbl">Immatriculation</div>
        <div class="val" style="font-size:1.05rem;font-weight:bold;color:#080808;letter-spacing:.08em;font-family:monospace">${plate}</div>
      </div>` : ''}
    </div>
  </div>
  <div class="qr-block">
    <div style="font-size:.68rem;color:#bbb;margin-bottom:10px;text-transform:uppercase;letter-spacing:.12em">QR Code de validation</div>
    <img src="https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${qrData}" width="130" height="130" alt="QR code mission">
    <div style="font-size:.65rem;color:#ccc;margin-top:8px">Scanner pour valider la prise en charge</div>
  </div>
</div>
</body></html>`;
}

/* ── EMAIL CONFIRMATION CLIENT (après paiement Stripe) ── */
async function buildConfirmationQrDataUrl(r) {
  const ref = r.ref || r.id || '';
  const dateStr = fmtDateFr(r.date);
  const qrText = [
    'IsmaDrive',
    'Ref:' + ref,
    'Trajet:' + (r.trajet || ''),
    'Date:' + dateStr + ' ' + (r.time || ''),
    'Client:' + (r.client || ''),
    'Vehicule:' + (r.vehicleName || r.vehicle || ''),
    'Statut:CONFIRME'
  ].join('|');
  return QRCode.toDataURL(qrText, {
    width: 260, margin: 2, errorCorrectionLevel: 'M',
    type: 'image/png', color: { dark: '#000000', light: '#ffffff' }
  });
}

function buildClientConfirmationHtml(r, qrDataUrl) {
  if (r.lang === 'en') return buildClientConfirmationHtmlEN(r, qrDataUrl);
  const client  = escHtml(r.client || 'cher client');
  const ref     = escHtml(r.ref || r.id || '');
  const trajet  = escHtml(r.trajet || '—');
  const dateStr = escHtml(fmtDateFr(r.date));
  const time    = escHtml(r.time || '—');
  const veh     = escHtml(r.vehicleName || r.vehicle || '—');
  const price   = escHtml(String(r.price || '—'));
  const equip   = r.equipment ? `<tr><td style="padding:6px 0;border-bottom:1px solid #f0ece4;color:#888;font-size:13px">Équipement</td><td style="padding:6px 0;border-bottom:1px solid #f0ece4;text-align:right;font-size:13px">${escHtml(r.equipment)}</td></tr>` : '';

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
        <tr><td style="padding:6px 0;border-bottom:1px solid #f0ece4;color:#888;font-size:13px">Date &amp; Heure</td><td style="padding:6px 0;border-bottom:1px solid #f0ece4;text-align:right;font-size:13px;color:#333">${dateStr} à ${time}</td></tr>
        <tr><td style="padding:6px 0;border-bottom:1px solid #f0ece4;color:#888;font-size:13px">Véhicule</td><td style="padding:6px 0;border-bottom:1px solid #f0ece4;text-align:right;font-size:13px;color:#333">${veh}</td></tr>
        ${equip}
        <tr><td style="padding:8px 0 0;color:#333;font-size:14px;font-weight:bold">Total payé</td><td style="padding:8px 0 0;text-align:right;font-size:16px;font-weight:bold;color:#c9a96e">${price} €</td></tr>
      </table>
    </div>

    <!-- QR code block -->
    <div style="background:#080808;border:1px solid #c9a96e;border-radius:3px;padding:22px;text-align:center;margin-bottom:22px">
      <div style="font-size:.63rem;color:#9a9185;letter-spacing:.2em;text-transform:uppercase;margin-bottom:6px">QR code obligatoire</div>
      <div style="font-family:Georgia,serif;font-size:1rem;color:#c9a96e;margin-bottom:16px">À présenter au conducteur avant le départ</div>
      <img src="${qrDataUrl}" width="200" height="200" alt="QR code réservation IsmaDrive" style="display:block;margin:0 auto;border:4px solid #fff;border-radius:2px"/>
      <div style="margin-top:14px;background:rgba(255,200,0,.1);border:1px solid rgba(255,200,0,.35);border-radius:2px;padding:10px 14px;font-size:.78rem;color:#f0e68c;line-height:1.5">
        ⚠️ Ce QR code est <strong>indispensable</strong>. Sans présentation au conducteur, la course ne peut pas démarrer.
      </div>
      <div style="margin-top:10px;font-size:.72rem;color:#555">Sauvegardez ce mail ou faites une capture d'écran.</div>
    </div>

    <p style="font-size:.85rem;color:#666;margin:0 0 8px;line-height:1.65">Une question ou un changement de dernière minute ?</p>
    <p style="margin:0 0 0;font-size:.85rem">
      <a href="https://wa.me/33623889717" style="color:#c9a96e;text-decoration:none">WhatsApp : +33 6 23 88 97 17</a>
    </p>
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
  const equip   = r.equipment ? `<tr><td style="padding:6px 0;border-bottom:1px solid #f0ece4;color:#888;font-size:13px">Equipment</td><td style="padding:6px 0;border-bottom:1px solid #f0ece4;text-align:right;font-size:13px">${escHtml(r.equipment)}</td></tr>` : '';

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
        <tr><td style="padding:6px 0;border-bottom:1px solid #f0ece4;color:#888;font-size:13px">Date &amp; Time</td><td style="padding:6px 0;border-bottom:1px solid #f0ece4;text-align:right;font-size:13px;color:#333">${dateStr} at ${time}</td></tr>
        <tr><td style="padding:6px 0;border-bottom:1px solid #f0ece4;color:#888;font-size:13px">Vehicle</td><td style="padding:6px 0;border-bottom:1px solid #f0ece4;text-align:right;font-size:13px;color:#333">${veh}</td></tr>
        ${equip}
        <tr><td style="padding:8px 0 0;color:#333;font-size:14px;font-weight:bold">Total paid</td><td style="padding:8px 0 0;text-align:right;font-size:16px;font-weight:bold;color:#c9a96e">${price} €</td></tr>
      </table>
    </div>

    <!-- QR code block -->
    <div style="background:#080808;border:1px solid #c9a96e;border-radius:3px;padding:22px;text-align:center;margin-bottom:22px">
      <div style="font-size:.63rem;color:#9a9185;letter-spacing:.2em;text-transform:uppercase;margin-bottom:6px">Mandatory QR code</div>
      <div style="font-family:Georgia,serif;font-size:1rem;color:#c9a96e;margin-bottom:16px">Show to your driver before departure</div>
      <img src="${qrDataUrl}" width="200" height="200" alt="IsmaDrive booking QR code" style="display:block;margin:0 auto;border:4px solid #fff;border-radius:2px"/>
      <div style="margin-top:14px;background:rgba(255,200,0,.1);border:1px solid rgba(255,200,0,.35);border-radius:2px;padding:10px 14px;font-size:.78rem;color:#f0e68c;line-height:1.5">
        ⚠️ This QR code is <strong>mandatory</strong>. Your ride cannot start without presenting it to the driver.
      </div>
      <div style="margin-top:10px;font-size:.72rem;color:#555">Save this email or take a screenshot.</div>
    </div>

    <p style="font-size:.85rem;color:#666;margin:0 0 8px;line-height:1.65">A question or last-minute change?</p>
    <p style="margin:0 0 0;font-size:.85rem">
      <a href="https://wa.me/33623889717" style="color:#c9a96e;text-decoration:none">WhatsApp: +33 6 23 88 97 17</a>
    </p>
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
  if (!email) return;
  const qrDataUrl = await buildConfirmationQrDataUrl(r);
  const html = buildClientConfirmationHtml(r, qrDataUrl);
  const subject = r.lang === 'en'
    ? `IsmaDrive — Booking confirmed · Ref. ${r.ref || r.id}`
    : `IsmaDrive — Réservation confirmée · Réf. ${r.ref || r.id}`;

  if (RESEND_API_KEY && RESEND_FROM_EMAIL) {
    const resend = new Resend(RESEND_API_KEY);
    await resend.emails.send({ from: RESEND_FROM_EMAIL, to: email, subject, html });
  } else {
    console.log(`📧 [local] Confirmation non envoyée (RESEND_API_KEY manquant) — destinataire : ${email}`);
  }
}

/* ── EMAIL AVIS CLIENT ── */
function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
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
  if (RESEND_API_KEY && RESEND_FROM_EMAIL) {
    const resend = new Resend(RESEND_API_KEY);
    const reviewSubject = r.lang === 'en'
      ? `IsmaDrive — Thank you for your trust · Ref. ${r.ref || r.id}`
      : `IsmaDrive — Merci pour votre confiance · Réf. ${r.ref || r.id}`;
    await resend.emails.send({ from: RESEND_FROM_EMAIL, to: email, subject: reviewSubject, html });
  }
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
      const updates = { status: 'confirmed', paymentStatus: 'paid', stripeSessionId: session.id, paidAt: new Date().toISOString() };
      await dbUpdateRes(reservationId, updates).catch(e => console.error('DB update error:', e.message));
      const r = await dbGetRes(reservationId).catch(() => null);
      console.log(`✅ Paiement confirmé pour réservation ${reservationId}`);
      if (r) sendClientConfirmationEmail(r).catch(e => console.error('Confirmation email error:', e.message));
    }
  }

  res.json({ received: true });
});

/* ── MIDDLEWARE ── */
app.use(express.json());

/* ── STRIPE CHECKOUT SESSION ── */
app.post('/api/create-checkout-session', async (req, res) => {
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({ error: 'Stripe non configuré — ajoutez STRIPE_SECRET_KEY dans vos variables d\'environnement.' });
  }
  const { date, time, durationMin, price, trajet, email } = req.body;
  const conflict = await checkConflict(date, time, durationMin || 60);
  if (conflict) return res.status(409).json({ error: 'Créneau indisponible', conflict });

  const id = Date.now().toString(36).toUpperCase().slice(-8);
  const newRes = { ...req.body, id, status: 'pending_payment', paymentStatus: 'unpaid', createdAt: new Date().toISOString() };

  try {
    await dbInsertRes(newRes);
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
      success_url: `${APP_URL}/payment-success?ref=${newRes.ref || id}&lang=${newRes.lang || 'fr'}`,
      cancel_url: `${APP_URL}/?cancelled=1`,
      metadata: { reservationId: id },
    });

    res.json({ url: session.url, id });
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
      nextSlot: next
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
    endMin:   timeToMin(r.time) + Number(r.durationMin || 60) + BUFFER_MIN
  }));
  res.json({ date, slots });
});

/* ── API : SAUVEGARDER RÉSERVATION ── */
app.post('/api/reservations', async (req, res) => {
  const { date, time, durationMin } = req.body;
  const conflict = await checkConflict(date, time, durationMin || 60);
  if (conflict) return res.status(409).json({ error: 'Créneau indisponible', conflict });
  const id     = Date.now().toString(36).toUpperCase().slice(-8);
  const newRes = { ...req.body, id, createdAt: new Date().toISOString() };
  await dbInsertRes(newRes);
  res.json({ ok: true, id });
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
  const id     = Date.now().toString(36).toUpperCase().slice(-8);
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
  const { pwd, name, phone, email, carCategory } = req.body;
  if (pwd !== ADMIN_PWD) return res.status(401).json({ error: 'Non autorisé' });
  if (!name || !email) return res.status(400).json({ error: 'Nom et email requis' });
  await dbInsertDriver({ id: Date.now().toString(36), name, phone: phone || '', email, carCategory: carCategory || '' });
  res.json({ ok: true });
});

/* ── CONDUCTEURS : modifier ── */
app.put('/api/drivers/:id', async (req, res) => {
  const { pwd, name, phone, email, carCategory } = req.body;
  if (pwd !== ADMIN_PWD) return res.status(401).json({ error: 'Non autorisé' });
  if (!name || !email) return res.status(400).json({ error: 'Nom et email requis' });
  await dbUpdateDriver(req.params.id, { name, phone: phone || '', email, carCategory: carCategory || '' });
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
  const { pwd, tripId, driverEmail, driverName, driverPrice } = req.body;
  if (pwd !== ADMIN_PWD) return res.status(401).json({ error: 'Non autorisé' });
  if (!RESEND_API_KEY) return res.status(503).json({ error: 'RESEND_API_KEY manquant.' });
  const r = await dbGetRes(tripId);
  if (!r) return res.status(404).json({ error: 'Course introuvable' });

  const token      = missionToken(tripId);
  const missionUrl = `${APP_URL}/mission-order/${tripId}?token=${token}`;
  const html       = buildDriverEmailHtml(r, driverName || '', missionUrl, driverPrice);
  const subject    = `Course IsmaDrive — ${fmtDateFr(r.date)} à ${r.time}`;

  try {
    const resend = new Resend(RESEND_API_KEY);
    await resend.emails.send({ from: RESEND_FROM_EMAIL, to: driverEmail, subject, html });
    if (driverName) {
      await dbInsertDriver({ id: Date.now().toString(36), name: driverName, email: driverEmail, phone: '', carCategory: '' });
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Erreur envoi : ' + e.message });
  }
});

/* ── ORDRE DE MISSION ── */
app.get('/mission-order/:id', async (req, res) => {
  const r = await dbGetRes(req.params.id);
  if (!r) return res.status(404).send('Course introuvable');
  const expected = missionToken(req.params.id);
  if (req.query.token !== expected && req.query.pwd !== ADMIN_PWD)
    return res.status(403).send('Accès refusé');
  res.send(buildMissionOrderHtml(r));
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

app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

// Pour Vercel, on exporte l'app au lieu de l'écouter
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`\n✅ Serveur démarré : http://localhost:${PORT}`);
    console.log(`   Admin    : http://localhost:${PORT}/admin`);
    console.log(`   Supabase : ${process.env.SUPABASE_URL ? '✅' : '❌ SUPABASE_URL manquant'}`);
    console.log(`   Resend   : ${RESEND_API_KEY ? '✅' : '❌ RESEND_API_KEY manquant'}\n`);
  });
}

module.exports = app;
