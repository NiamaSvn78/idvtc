const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, '..', 'vtc-project', 'server.js');
const outPath = path.join(__dirname, '..', 'lib', 'client-confirmation-email.js');
const src = fs.readFileSync(serverPath, 'utf8');

const start = src.indexOf('/* ── EMAIL CONFIRMATION CLIENT');
const end = src.indexOf('/* ── EMAIL AVIS CLIENT');
if (start < 0 || end < 0) {
  console.error('Markers not found');
  process.exit(1);
}

let body = src.slice(start, end).trim();
body = body.replace(/^\/\* ── EMAIL CONFIRMATION CLIENT[^\n]*\n/, '');
body = body.replace(/\bAPP_URL\b/g, 'appUrl');
body = body.replace(/\bRESEND_FROM\b/g, 'from');
body = body.replace(/\bRESEND_BCC_EMAIL\b/g, 'bccEmail');
body = body.replace(/await dbUpdateRes\(r\.id, \{ confirmationEmailSent: true \}\)/g,
  'await markSent(r.id)');

const header = `/**
 * Email confirmation client après paiement Stripe (QR → /reservation/:id).
 */
const QRCode = require('qrcode');

function createClientConfirmationMailer(opts) {
  const appUrl = String(opts.appUrl || '').replace(/\\/$/, '');
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
    return \`\${d}/\${mo}/\${y}\`;
  }

`;

const footer = `
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
`;

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, header + body + footer, 'utf8');
console.log('Wrote', outPath);
