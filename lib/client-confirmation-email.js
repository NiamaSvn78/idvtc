/**
 * Email confirmation client après paiement Stripe (QR hébergés + fond blanc).
 */
const {
  escHtml,
  fmtDateFr,
  parsePrestationsFromNotes,
  reservationUrl,
} = require('./booking-courses');

/** Image PNG via API (fond blanc garanti côté serveur). */
function qrApiImageUrl(appUrl, reservationId, courseIdx) {
  const q = courseIdx > 1 ? `?course=${courseIdx}` : '';
  return `${String(appUrl).replace(/\/$/, '')}/api/reservations/${reservationId}/qrcode${q}`;
}

/** Encart blanc — lisible dans Gmail, Outlook, Apple Mail. */
function qrImgHtml(imageUrl, size = 200) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:14px auto 0">
  <tr><td align="center" bgcolor="#ffffff" style="background-color:#ffffff;padding:18px;border-radius:6px;border:2px solid #e0e0e0">
    <img src="${imageUrl}" width="${size}" height="${size}" alt="QR code IsmaDrive"
      style="display:block;border:0;outline:none;background-color:#ffffff;max-width:${size}px;height:auto"/>
  </td></tr></table>`;
}

function prestBlocksHtml(prestDetails, prestQrUrls, lang) {
  if (!prestDetails.length) return '';
  const label = lang === 'en' ? 'Ride' : 'Course';
  return prestDetails
    .map(
      (detail, i) => `
    <div style="border-top:1px solid #e8e0d0;padding-top:16px;margin-bottom:20px">
      <div style="font-size:.63rem;color:#9a9185;text-transform:uppercase;letter-spacing:.16em;margin-bottom:8px">${label} ${i + 2}</div>
      <div style="background:#f9f7f4;border:1px solid #e8e0d0;border-radius:3px;padding:12px 16px;margin-bottom:14px;font-size:.83rem;color:#444;line-height:1.5">${escHtml(detail)}</div>
      ${
        prestQrUrls[i]
          ? `<div style="background:#f9f7f4;border:2px solid #c9a96e;border-radius:6px;padding:16px;text-align:center;margin-bottom:8px">
          <div style="font-size:.6rem;color:#888;letter-spacing:.15em;text-transform:uppercase;margin-bottom:6px">QR code — ${label} ${i + 2}</div>
          ${qrImgHtml(prestQrUrls[i], 160)}
        </div>`
          : ''
      }
    </div>`
    )
    .join('');
}

function createClientConfirmationMailer(opts) {
  const appUrl = String(opts.appUrl || '').replace(/\/$/, '');
  const from = opts.from || '';
  const bccEmail = String(opts.bccEmail || '').trim();
  const resendEmailsSend = opts.resendSend;
  const markSent = opts.markSent || (async () => {});
  const persistEmail = opts.persistEmail || (async () => {});

  function buildClientConfirmationHtml(r, mainQrUrl, prestDetails = [], prestQrUrls = []) {
    if (r.lang === 'en') return buildClientConfirmationHtmlEN(r, mainQrUrl, prestDetails, prestQrUrls);
    const client = escHtml(r.client || 'cher client');
    const ref = escHtml(r.ref || r.id || '');
    const trajet = escHtml(r.trajet || '—');
    const dateStr = escHtml(fmtDateFr(r.date));
    const time = escHtml(r.time || '—');
    const veh = escHtml(r.vehicleName || r.vehicle || '—');
    const price = escHtml(String(r.price || '—'));
    const equip = r.equipment
      ? `<tr><td style="padding:6px 0;border-bottom:1px solid #f0ece4;color:#888;font-size:13px">Équipement</td><td style="padding:6px 0;border-bottom:1px solid #f0ece4;text-align:right;font-size:13px">${escHtml(r.equipment)}</td></tr>`
      : '';
    const tripModeRow =
      r.tripMode && r.tripMode !== 'one-way'
        ? `<tr><td style="padding:6px 0;border-bottom:1px solid #f0ece4;color:#888;font-size:13px">Type de trajet</td><td style="padding:6px 0;border-bottom:1px solid #f0ece4;text-align:right;font-size:13px;color:#333">Aller-retour</td></tr>`
        : '';
    const returnAddrRow = r.returnAddr
      ? `<tr><td style="padding:6px 0;border-bottom:1px solid #f0ece4;color:#888;font-size:13px">Adresse de retour</td><td style="padding:6px 0;border-bottom:1px solid #f0ece4;text-align:right;font-size:13px;color:#333">${escHtml(r.returnAddr)}</td></tr>`
      : '';
    const returnDateRow = r.returnDate
      ? `<tr><td style="padding:6px 0;border-bottom:1px solid #f0ece4;color:#888;font-size:13px">Date &amp; Heure retour</td><td style="padding:6px 0;border-bottom:1px solid #f0ece4;text-align:right;font-size:13px;color:#333">${escHtml(fmtDateFr(r.returnDate))} à ${escHtml(r.returnTime || '—')}</td></tr>`
      : '';
    const mainResUrl = reservationUrl(appUrl, r.id, 1);
    const qrTitle =
      prestDetails.length > 0
        ? 'QR code obligatoire — Course 1'
        : 'QR code obligatoire';

    return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;color:#333">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:24px 0">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:4px;overflow:hidden;border:1px solid #e8e8e8">
  <tr><td style="background:#080808;padding:24px 32px;border-bottom:2px solid #c9a96e">
    <div style="font-family:Georgia,serif;font-size:1.5rem;color:#c9a96e;letter-spacing:.1em">IsmaDrive</div>
    <div style="font-size:.68rem;color:#9a9185;letter-spacing:.2em;text-transform:uppercase;margin-top:4px">Confirmation de réservation</div>
  </td></tr>
  <tr><td style="background:#080808;padding:28px 32px 24px;text-align:center;border-bottom:1px solid #1a1a1a">
    <div style="width:56px;height:56px;background:rgba(39,174,96,.15);border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-bottom:14px">
      <span style="font-size:26px;line-height:1">✓</span>
    </div>
    <div style="font-family:Georgia,serif;font-size:1.6rem;font-weight:400;color:#f0ece4;margin-bottom:6px">Paiement confirmé</div>
    <div style="font-size:.85rem;color:#9a9185">Votre réservation est enregistrée. Votre chauffeur sera ponctuel.</div>
  </td></tr>
  <tr><td style="padding:28px 32px 20px">
    <p style="margin:0 0 6px;font-size:15px;line-height:1.6">Bonjour <strong>${client}</strong>,</p>
    <p style="margin:0 0 20px;font-size:14px;color:#555;line-height:1.65">Votre paiement a bien été reçu. Retrouvez ci-dessous le récapitulatif et un QR code par course.</p>
    <div style="background:#f9f7f4;border:1px solid #e8e0d0;border-radius:3px;padding:16px 20px;margin-bottom:22px">
      <div style="font-size:.63rem;color:#9a9185;text-transform:uppercase;letter-spacing:.16em;margin-bottom:12px">Récapitulatif</div>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding:6px 0;border-bottom:1px solid #e8e0d0;color:#888;font-size:13px">Référence</td><td style="padding:6px 0;border-bottom:1px solid #e8e0d0;text-align:right;font-weight:bold;color:#080808;font-size:13px;letter-spacing:.05em">${ref}</td></tr>
        <tr><td style="padding:6px 0;border-bottom:1px solid #f0ece4;color:#888;font-size:13px">Trajet</td><td style="padding:6px 0;border-bottom:1px solid #f0ece4;text-align:right;font-size:13px;color:#333">${trajet}</td></tr>
        ${tripModeRow}${returnAddrRow}${returnDateRow}
        <tr><td style="padding:6px 0;border-bottom:1px solid #f0ece4;color:#888;font-size:13px">Date &amp; Heure aller</td><td style="padding:6px 0;border-bottom:1px solid #f0ece4;text-align:right;font-size:13px;color:#333">${dateStr} à ${time}</td></tr>
        <tr><td style="padding:6px 0;border-bottom:1px solid #f0ece4;color:#888;font-size:13px">Véhicule</td><td style="padding:6px 0;border-bottom:1px solid #f0ece4;text-align:right;font-size:13px;color:#333">${veh}</td></tr>
        ${equip}
        <tr><td style="padding:8px 0 0;color:#333;font-size:14px;font-weight:bold">Total payé</td><td style="padding:8px 0 0;text-align:right;font-size:16px;font-weight:bold;color:#c9a96e">${price} €</td></tr>
      </table>
    </div>
    <div style="text-align:center;margin-bottom:18px;padding:16px 20px;background:#f9f7f4;border:1px solid #e8e0d0;border-radius:3px">
      <div style="font-size:.65rem;color:#9a9185;text-transform:uppercase;letter-spacing:.16em;margin-bottom:8px">Votre numéro de réservation</div>
      <div style="font-size:1.5rem;font-weight:bold;font-family:monospace;color:#080808;letter-spacing:.06em">${ref}</div>
      <div style="font-size:.75rem;color:#999;margin-top:4px">À dicter à votre chauffeur si besoin</div>
    </div>
    <div style="background:#f9f7f4;border:2px solid #c9a96e;border-radius:6px;padding:22px;text-align:center;margin-bottom:16px">
      <div style="font-size:.63rem;color:#888;letter-spacing:.2em;text-transform:uppercase;margin-bottom:6px">${qrTitle}</div>
      <div style="font-family:Georgia,serif;font-size:1rem;color:#080808;margin-bottom:4px">À présenter au conducteur avant le départ</div>
      ${qrImgHtml(mainQrUrl, 200)}
      <div style="margin-top:12px;font-size:.72rem;color:#666">Sauvegardez ce mail ou faites une capture d'écran.</div>
    </div>
    ${prestBlocksHtml(prestDetails, prestQrUrls, 'fr')}
    <div style="text-align:center;margin-bottom:12px">
      <a href="${mainResUrl}" style="display:inline-block;background:#080808;color:#fff;padding:12px 28px;text-decoration:none;font-size:.85rem;font-weight:bold;border-radius:4px;letter-spacing:.04em">📋 Accéder à ma réservation</a>
    </div>
    <div style="text-align:center;margin-bottom:18px">
      <div style="font-size:.75rem;color:#888;margin-bottom:6px">Ou copiez ce lien :</div>
      <div style="background:#f5f5f5;color:#333;padding:10px;font-size:.78rem;word-break:break-all;border-radius:3px;border:1px solid #eee;font-family:monospace;text-align:left">${mainResUrl}</div>
    </div>
    <p style="text-align:center;font-size:.8rem;color:#666;margin:0 0 22px;line-height:1.5">Présentez le QR code correspondant à chaque course.</p>
    <p style="font-size:.85rem;color:#666;margin:0 0 8px;line-height:1.65">Une question ou un changement de dernière minute ?</p>
    <p style="margin:0 0 18px;font-size:.85rem">
      <a href="https://wa.me/33623889717" style="color:#c9a96e;text-decoration:none">WhatsApp : +33 6 23 88 97 17</a>
    </p>
    <div style="padding-top:12px;border-top:1px solid #eee;text-align:center">
      <a href="https://ismadrive.fr/cgv" style="color:#bbb;font-size:11px;text-decoration:underline">Politique d'annulation</a>${r.cancellationToken ? ` &nbsp;·&nbsp; <a href="${appUrl}/annuler-reservation?token=${encodeURIComponent(r.cancellationToken)}" style="color:#bbb;font-size:11px;text-decoration:underline">Annuler ma réservation</a>` : ''}
    </div>
  </td></tr>
  <tr><td style="background:#f9f9f9;border-top:1px solid #eee;padding:14px 32px;text-align:center">
    <div style="font-size:11px;color:#aaa">Réf. ${ref} &nbsp;·&nbsp; IsmaDrive &nbsp;·&nbsp; <a href="https://ismadrive.fr" style="color:#c9a96e;text-decoration:none">ismadrive.fr</a></div>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;
  }

  function buildClientConfirmationHtmlEN(r, mainQrUrl, prestDetails = [], prestQrUrls = []) {
    const client = escHtml(r.client || 'valued customer');
    const ref = escHtml(r.ref || r.id || '');
    const trajet = escHtml(r.trajet || '—');
    const dateStr = escHtml(fmtDateFr(r.date));
    const time = escHtml(r.time || '—');
    const veh = escHtml(r.vehicleName || r.vehicle || '—');
    const price = escHtml(String(r.price || '—'));
    const equip = r.equipment
      ? `<tr><td style="padding:6px 0;border-bottom:1px solid #f0ece4;color:#888;font-size:13px">Equipment</td><td style="padding:6px 0;border-bottom:1px solid #f0ece4;text-align:right;font-size:13px">${escHtml(r.equipment)}</td></tr>`
      : '';
    const tripModeRow =
      r.tripMode && r.tripMode !== 'one-way'
        ? `<tr><td style="padding:6px 0;border-bottom:1px solid #f0ece4;color:#888;font-size:13px">Trip type</td><td style="padding:6px 0;border-bottom:1px solid #f0ece4;text-align:right;font-size:13px;color:#333">Round trip</td></tr>`
        : '';
    const returnAddrRow = r.returnAddr
      ? `<tr><td style="padding:6px 0;border-bottom:1px solid #f0ece4;color:#888;font-size:13px">Return address</td><td style="padding:6px 0;border-bottom:1px solid #f0ece4;text-align:right;font-size:13px;color:#333">${escHtml(r.returnAddr)}</td></tr>`
      : '';
    const returnDateRow = r.returnDate
      ? `<tr><td style="padding:6px 0;border-bottom:1px solid #f0ece4;color:#888;font-size:13px">Return date &amp; time</td><td style="padding:6px 0;border-bottom:1px solid #f0ece4;text-align:right;font-size:13px;color:#333">${escHtml(fmtDateFr(r.returnDate))} at ${escHtml(r.returnTime || '—')}</td></tr>`
      : '';
    const mainResUrl = reservationUrl(appUrl, r.id, 1);
    const qrTitle = prestDetails.length > 0 ? 'Mandatory QR code — Ride 1' : 'Mandatory QR code';

    return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;color:#333">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:24px 0">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:4px;overflow:hidden;border:1px solid #e8e8e8">
  <tr><td style="background:#080808;padding:24px 32px;border-bottom:2px solid #c9a96e">
    <div style="font-family:Georgia,serif;font-size:1.5rem;color:#c9a96e;letter-spacing:.1em">IsmaDrive</div>
    <div style="font-size:.68rem;color:#9a9185;letter-spacing:.2em;text-transform:uppercase;margin-top:4px">Booking confirmation</div>
  </td></tr>
  <tr><td style="background:#080808;padding:28px 32px 24px;text-align:center;border-bottom:1px solid #1a1a1a">
    <div style="width:56px;height:56px;background:rgba(39,174,96,.15);border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-bottom:14px">
      <span style="font-size:26px;line-height:1">✓</span>
    </div>
    <div style="font-family:Georgia,serif;font-size:1.6rem;font-weight:400;color:#f0ece4;margin-bottom:6px">Payment confirmed</div>
    <div style="font-size:.85rem;color:#9a9185">Your booking is confirmed. Your driver will be on time.</div>
  </td></tr>
  <tr><td style="padding:28px 32px 20px">
    <p style="margin:0 0 6px;font-size:15px;line-height:1.6">Hello <strong>${client}</strong>,</p>
    <p style="margin:0 0 20px;font-size:14px;color:#555;line-height:1.65">Your payment has been received. Below is your summary and one QR code per ride.</p>
    <div style="background:#f9f7f4;border:1px solid #e8e0d0;border-radius:3px;padding:16px 20px;margin-bottom:22px">
      <div style="font-size:.63rem;color:#9a9185;text-transform:uppercase;letter-spacing:.16em;margin-bottom:12px">Summary</div>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding:6px 0;border-bottom:1px solid #e8e0d0;color:#888;font-size:13px">Reference</td><td style="padding:6px 0;border-bottom:1px solid #e8e0d0;text-align:right;font-weight:bold;color:#080808;font-size:13px;letter-spacing:.05em">${ref}</td></tr>
        <tr><td style="padding:6px 0;border-bottom:1px solid #f0ece4;color:#888;font-size:13px">Trip</td><td style="padding:6px 0;border-bottom:1px solid #f0ece4;text-align:right;font-size:13px;color:#333">${trajet}</td></tr>
        ${tripModeRow}${returnAddrRow}${returnDateRow}
        <tr><td style="padding:6px 0;border-bottom:1px solid #f0ece4;color:#888;font-size:13px">Outbound date &amp; time</td><td style="padding:6px 0;border-bottom:1px solid #f0ece4;text-align:right;font-size:13px;color:#333">${dateStr} at ${time}</td></tr>
        <tr><td style="padding:6px 0;border-bottom:1px solid #f0ece4;color:#888;font-size:13px">Vehicle</td><td style="padding:6px 0;border-bottom:1px solid #f0ece4;text-align:right;font-size:13px;color:#333">${veh}</td></tr>
        ${equip}
        <tr><td style="padding:8px 0 0;color:#333;font-size:14px;font-weight:bold">Total paid</td><td style="padding:8px 0 0;text-align:right;font-size:16px;font-weight:bold;color:#c9a96e">${price} €</td></tr>
      </table>
    </div>
    <div style="text-align:center;margin-bottom:18px;padding:16px 20px;background:#f9f7f4;border:1px solid #e8e0d0;border-radius:3px">
      <div style="font-size:.65rem;color:#9a9185;text-transform:uppercase;letter-spacing:.16em;margin-bottom:8px">Your booking reference</div>
      <div style="font-size:1.5rem;font-weight:bold;font-family:monospace;color:#080808;letter-spacing:.06em">${ref}</div>
    </div>
    <div style="background:#f9f7f4;border:2px solid #c9a96e;border-radius:6px;padding:22px;text-align:center;margin-bottom:16px">
      <div style="font-size:.63rem;color:#888;letter-spacing:.2em;text-transform:uppercase;margin-bottom:6px">${qrTitle}</div>
      <div style="font-family:Georgia,serif;font-size:1rem;color:#080808;margin-bottom:4px">Show to your driver before departure</div>
      ${qrImgHtml(mainQrUrl, 200)}
      <div style="margin-top:12px;font-size:.72rem;color:#666">Save this email or take a screenshot.</div>
    </div>
    ${prestBlocksHtml(prestDetails, prestQrUrls, 'en')}
    <div style="text-align:center;margin-bottom:12px">
      <a href="${mainResUrl}" style="display:inline-block;background:#080808;color:#fff;padding:12px 28px;text-decoration:none;font-size:.85rem;font-weight:bold;border-radius:4px;letter-spacing:.04em">📋 Access my booking</a>
    </div>
    <div style="text-align:center;margin-bottom:18px">
      <div style="font-size:.75rem;color:#888;margin-bottom:6px">Or copy this link:</div>
      <div style="background:#f5f5f5;color:#333;padding:10px;font-size:.78rem;word-break:break-all;border-radius:3px;border:1px solid #eee;font-family:monospace;text-align:left">${mainResUrl}</div>
    </div>
    <p style="text-align:center;font-size:.8rem;color:#666;margin:0 0 22px;line-height:1.5">Present the QR code matching each ride.</p>
    <p style="font-size:.85rem;color:#666;margin:0 0 8px;line-height:1.65">A question or last-minute change?</p>
    <p style="margin:0 0 18px;font-size:.85rem">
      <a href="https://wa.me/33623889717" style="color:#c9a96e;text-decoration:none">WhatsApp: +33 6 23 88 97 17</a>
    </p>
    <div style="padding-top:12px;border-top:1px solid #eee;text-align:center">
      <a href="https://ismadrive.fr/cgv" style="color:#bbb;font-size:11px;text-decoration:underline">Cancellation policy</a>${r.cancellationToken ? ` &nbsp;·&nbsp; <a href="${appUrl}/annuler-reservation?token=${encodeURIComponent(r.cancellationToken)}" style="color:#bbb;font-size:11px;text-decoration:underline">Cancel my booking</a>` : ''}
    </div>
  </td></tr>
  <tr><td style="background:#f9f9f9;border-top:1px solid #eee;padding:14px 32px;text-align:center">
    <div style="font-size:11px;color:#aaa">Ref. ${ref} &nbsp;·&nbsp; IsmaDrive &nbsp;·&nbsp; <a href="https://ismadrive.fr" style="color:#c9a96e;text-decoration:none">ismadrive.fr</a></div>
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

    const prestDetails = parsePrestationsFromNotes(r.notes);
    const mainQrUrl = qrApiImageUrl(appUrl, r.id, 1);
    const prestQrUrls = prestDetails.map((_, i) => qrApiImageUrl(appUrl, r.id, i + 2));
    const html = buildClientConfirmationHtml(r, mainQrUrl, prestDetails, prestQrUrls);
    const subject =
      r.lang === 'en'
        ? `IsmaDrive — Booking confirmed · Ref. ${r.ref || r.id}`
        : `IsmaDrive — Réservation confirmée · Réf. ${r.ref || r.id}`;

    const payload = { from, to: email, subject, html };
    if (bccEmail && bccEmail.toLowerCase() !== email.toLowerCase()) {
      payload.bcc = [bccEmail];
    }

    const { error } = await resendEmailsSend(payload);
    if (error) {
      throw new Error(error.message || JSON.stringify(error));
    }

    if (r.id) {
      await markSent(r.id).catch((e) =>
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
