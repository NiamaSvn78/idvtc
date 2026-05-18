/**
 * Email confirmation client après paiement Stripe (QR → /reservation/:id).
 */
const QRCode = require('qrcode');

function createClientConfirmationMailer(opts) {
  const appUrl = String(opts.appUrl || '').replace(/\/$/, '');
  const from = opts.from || '';
  const bccEmail = String(opts.bccEmail || '').trim();
  const resendEmailsSend = opts.resendSend;
  const markSent = opts.markSent || (async () => {});
  const persistEmail = opts.persistEmail || (async () => {});

  function escHtml(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function fmtDateFr(iso) {
    if (!iso) return '—';
    const [y, mo, d] = iso.split('-');
    return `${d}/${mo}/${y}`;
  }

async function buildConfirmationQrDataUrl(r) {
  const id  = r.id || '';
  const url = `${appUrl}/reservation/${id}`;
  return QRCode.toDataURL(url, {
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
  const equip          = r.equipment ? `<tr><td style="padding:6px 0;border-bottom:1px solid #f0ece4;color:#888;font-size:13px">Équipement</td><td style="padding:6px 0;border-bottom:1px solid #f0ece4;text-align:right;font-size:13px">${escHtml(r.equipment)}</td></tr>` : '';
  const reservationUrl = `${appUrl}/reservation/${r.id || ''}`;

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

    <!-- Bouton + URL en clair -->
    <div style="text-align:center;margin-bottom:12px">
      <a href="${reservationUrl}" style="display:inline-block;background:#080808;color:#fff;padding:12px 28px;text-decoration:none;font-size:.85rem;font-weight:bold;border-radius:4px;letter-spacing:.04em">📋 Accéder à ma réservation</a>
    </div>
    <div style="text-align:center;margin-bottom:18px">
      <div style="font-size:.75rem;color:#888;margin-bottom:6px">Ou copiez ce lien dans votre navigateur :</div>
      <div style="background:#f5f5f5;color:#333;padding:10px;font-size:.78rem;word-break:break-all;border-radius:3px;border:1px solid #eee;font-family:monospace;text-align:left">${reservationUrl}</div>
    </div>
    <p style="text-align:center;font-size:.8rem;color:#666;margin:0 0 22px;line-height:1.5">Présentez l'un de ces éléments à votre chauffeur.</p>

    <!-- Politique d'annulation -->
    <div style="border:1px solid #e8e0d0;border-radius:3px;padding:14px 18px;margin-bottom:18px;background:#fafaf8">
      <div style="font-size:.63rem;color:#9a9185;text-transform:uppercase;letter-spacing:.16em;margin-bottom:10px">Politique d'annulation</div>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding:4px 0;font-size:13px">✅ Plus de 72h avant la course</td><td style="padding:4px 0;text-align:right;font-size:13px;color:#27ae60;font-weight:bold">Remboursement intégral</td></tr>
        <tr><td style="padding:4px 0;font-size:13px">🟡 Entre 72h et 12h avant</td><td style="padding:4px 0;text-align:right;font-size:13px;color:#c9860a;font-weight:bold">Remboursement 50%</td></tr>
        <tr><td style="padding:4px 0;font-size:13px">❌ Moins de 12h avant</td><td style="padding:4px 0;text-align:right;font-size:13px;color:#c0392b;font-weight:bold">Aucun remboursement</td></tr>
      </table>
      ${r.cancellationToken ? `<div style="margin-top:12px;padding-top:10px;border-top:1px solid #e8e0d0;text-align:center"><a href="${appUrl}/annuler-reservation?token=${encodeURIComponent(r.cancellationToken)}" style="color:#888;font-size:12px;text-decoration:underline">Annuler ma réservation</a><div style="font-size:11px;color:#bbb;margin-top:3px">Ce lien est valable jusqu'à l'heure de la course.</div></div>` : ''}
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
  const equip          = r.equipment ? `<tr><td style="padding:6px 0;border-bottom:1px solid #f0ece4;color:#888;font-size:13px">Equipment</td><td style="padding:6px 0;border-bottom:1px solid #f0ece4;text-align:right;font-size:13px">${escHtml(r.equipment)}</td></tr>` : '';
  const reservationUrl = `${appUrl}/reservation/${r.id || ''}`;

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

    <!-- Button + plain URL -->
    <div style="text-align:center;margin-bottom:12px">
      <a href="${reservationUrl}" style="display:inline-block;background:#080808;color:#fff;padding:12px 28px;text-decoration:none;font-size:.85rem;font-weight:bold;border-radius:4px;letter-spacing:.04em">📋 Access my booking</a>
    </div>
    <div style="text-align:center;margin-bottom:18px">
      <div style="font-size:.75rem;color:#888;margin-bottom:6px">Or copy this link in your browser:</div>
      <div style="background:#f5f5f5;color:#333;padding:10px;font-size:.78rem;word-break:break-all;border-radius:3px;border:1px solid #eee;font-family:monospace;text-align:left">${reservationUrl}</div>
    </div>
    <p style="text-align:center;font-size:.8rem;color:#666;margin:0 0 22px;line-height:1.5">Present any of these to your driver.</p>

    <!-- Cancellation policy -->
    <div style="border:1px solid #e8e0d0;border-radius:3px;padding:14px 18px;margin-bottom:18px;background:#fafaf8">
      <div style="font-size:.63rem;color:#9a9185;text-transform:uppercase;letter-spacing:.16em;margin-bottom:10px">Cancellation policy</div>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding:4px 0;font-size:13px">✅ More than 72h before the trip</td><td style="padding:4px 0;text-align:right;font-size:13px;color:#27ae60;font-weight:bold">Full refund</td></tr>
        <tr><td style="padding:4px 0;font-size:13px">🟡 Between 72h and 12h before</td><td style="padding:4px 0;text-align:right;font-size:13px;color:#c9860a;font-weight:bold">50% refund</td></tr>
        <tr><td style="padding:4px 0;font-size:13px">❌ Less than 12h before</td><td style="padding:4px 0;text-align:right;font-size:13px;color:#c0392b;font-weight:bold">No refund</td></tr>
      </table>
      ${r.cancellationToken ? `<div style="margin-top:12px;padding-top:10px;border-top:1px solid #e8e0d0;text-align:center"><a href="${appUrl}/annuler-reservation?token=${encodeURIComponent(r.cancellationToken)}" style="color:#888;font-size:12px;text-decoration:underline">Cancel my booking</a><div style="font-size:11px;color:#bbb;margin-top:3px">This link is valid until the time of your trip.</div></div>` : ''}
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
  if (!email) return { ok: false, reason: 'no_email' };
  if (r.confirmationEmailSent === true) {
    console.log('[Resend] Confirmation déjà enregistrée, pas de renvoi —', r.ref || r.id);
    return { ok: true, skipped: true };
  }

  const qrDataUrl = await buildConfirmationQrDataUrl(r);
  const html = buildClientConfirmationHtml(r, qrDataUrl);
  const subject = r.lang === 'en'
    ? `IsmaDrive — Booking confirmed · Ref. ${r.ref || r.id}`
    : `IsmaDrive — Réservation confirmée · Réf. ${r.ref || r.id}`;

  const payload = { from: from, to: email, subject, html };
  if (bccEmail && bccEmail.toLowerCase() !== email.toLowerCase()) {
    payload.bcc = [bccEmail];
  }

  const { error } = await resendEmailsSend(payload);
  if (error) {
    throw new Error(error.message || JSON.stringify(error));
  }

  if (r.id) {
    await markSent(r.id).catch(e =>
      console.error('[Resend] confirmationEmailSent DB:', e.message)
    );
  }
  return { ok: true };
}
  async function sendAfterPayment(r, stripeCustomerEmail) {
    let row = r;
    const resolved = String(row?.email || stripeCustomerEmail || '').trim();
    if (!resolved) return { ok: false, reason: 'no_email' };
    if (!row.email && stripeCustomerEmail && row.id) {
      await persistEmail(row.id, resolved).catch(() => {});
      row = { ...row, email: resolved };
    }
    return sendClientConfirmationEmail(row);
  }

  return { sendClientConfirmationEmail, sendAfterPayment };
}

module.exports = { createClientConfirmationMailer };
