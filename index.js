const express = require('express');
const path = require('path');
const QRCode = require('qrcode');
const { Resend } = require('resend');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = process.env.PORT || 3000;

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const RESEND_FROM = process.env.RESEND_FROM_EMAIL || '';
/** Copie invisible vers votre boîte — conserve nom, tel, email, trajet, QR (sans base de données). */
const RESEND_BCC_EMAIL = String(process.env.RESEND_BCC_EMAIL || '').trim();
const PUBLIC_SITE_URL = process.env.APP_URL || 'https://ismadrive.fr';
const WHATSAPP_BOOKING_URL = 'https://wa.me/33623889717';
const GOOGLE_REVIEWS_URL = String(process.env.GOOGLE_REVIEWS_URL || 'https://g.page/r/CWL4dJY-hj2oEAE/review').trim();
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hawwbdpixtmdgnftklsd.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = SUPABASE_URL && SUPABASE_SERVICE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  : null;

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
    const { data, error } = await supabase
      .from('reservations').update(updates).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return data;
  }
  const idx = _mem.findIndex(r => r.id === id);
  if (idx === -1) return null;
  _mem[idx] = { ..._mem[idx], ...updates };
  return _mem[idx];
}

/* ── Middleware ── */
app.use(express.json());

function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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
app.post('/api/reservations', async (req, res) => {
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

app.get('/api/reservations', async (req, res) => {
  const { pwd } = req.query;
  if (pwd !== 'idvtc2024') return res.status(401).json({ error: 'Unauthorized' });
  try {
    res.json(await dbList());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/reservations/:id', async (req, res) => {
  const { pwd, ...updates } = req.body || {};
  if (pwd !== 'idvtc2024') return res.status(401).json({ error: 'Non autorisé' });
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

app.post('/api/check-availability', (req, res) => {
  res.json({ available: true });
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
