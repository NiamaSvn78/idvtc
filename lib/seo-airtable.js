'use strict';
/**
 * Lecture des actions SEO validées dans Airtable (table « Actions ») au build.
 * Chaque enregistrement est converti au format attendu par lib/seo-blocs.js
 * (action_id, type, page_path, bloc_md, bloc_en, title, meta, liens, created_at).
 *
 * Variables : AIRTABLE_TOKEN (lecture seule, data.records:read), AIRTABLE_BASE_ID.
 */
const { normalizePagePath, isKnownPage } = require('./seo-blocs');

const TABLE_ID = 'tblsHRVgQQxKQ8gbM'; // « Actions »
const F = {
  statut: 'fldYpclzKiLeH8xXj',
  dateFaite: 'fld6TgbMToa28gSLn',
  page: 'fldeeQ31qlYeTClI5',   // lookup (url)
  type: 'fldMq3of2yTSiKdAl',   // lookup (texte)
  bloc: 'fldX3EAWw0xKDbCx9',
  blocEn: 'fldcfFoGk7OqSwYyo',
  title: 'fldQ2pU4pvZvAvrle',
  meta: 'fldKpgdTNpZuad7yN',
  liens: 'fld2PgmrvzQpTX0tp',
};
const STATUTS_PUBLIES = ['Fait', 'Mesuré'];
const CONTENT_FIELDS = [F.bloc, F.blocEn, F.title, F.meta, F.liens];
const MAX = { type: 60, bloc: 60000, title: 300, meta: 600, liens: 20000 };
const MAX_PAGES = 50;              // garde-fou pagination (50 × 100 enregistrements)
const REQUEST_TIMEOUT_MS = 8000;

function text(v, max) {
  if (Array.isArray(v)) v = v[0];
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s ? s.slice(0, max) : null;
}

function selectName(v) {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v.name;
  return typeof v === 'string' ? v : null;
}

/**
 * Enregistrement Airtable (returnFieldsByFieldId=true) → bloc, ou null s'il
 * n'est pas publiable. `warn` reçoit les anomalies non bloquantes.
 */
function recordToBloc(rec, warn = () => {}) {
  const f = (rec && rec.fields) || {};
  if (!STATUTS_PUBLIES.includes(selectName(f[F.statut]))) return null;
  if (!CONTENT_FIELDS.some((id) => text(f[id], Infinity))) return null;

  const pages = Array.isArray(f[F.page]) ? f[F.page] : (f[F.page] ? [f[F.page]] : []);
  if (pages.length > 1) warn(`${rec.id} : ${pages.length} pages cibles, seule la première est utilisée`);
  const pagePath = pages.length ? normalizePagePath(pages[0]) : null;
  if (pages.length && !isKnownPage(pagePath)) {
    warn(`${rec.id} : page cible hors liste (${pages[0]}) — seuls ses liens internes seront utilisés`);
  }

  // Tri : Date faite (jour), puis heure de création de l'enregistrement pour départager.
  const day = typeof f[F.dateFaite] === 'string' ? f[F.dateFaite] : null;
  if (!day) warn(`${rec.id} : Date faite vide — classé en premier`);

  return {
    action_id: rec.id,
    type: text(f[F.type], MAX.type),
    page_path: pagePath && isKnownPage(pagePath) ? pagePath : null,
    bloc_md: text(f[F.bloc], MAX.bloc),
    bloc_en: text(f[F.blocEn], MAX.bloc),
    title: text(f[F.title], MAX.title),
    meta: text(f[F.meta], MAX.meta),
    liens: text(f[F.liens], MAX.liens),
    created_at: day || '1970-01-01',
    created_time: rec.createdTime || null,
  };
}

/**
 * Récupère toutes les pages de résultats (offset) et renvoie les blocs publiables.
 * Lève une erreur si Airtable est injoignable / en erreur : l'appelant décide.
 */
async function fetchBlocsFromAirtable({ token, baseId, fetchImpl = fetch, warn = () => {} }) {
  if (!token || !baseId) throw new Error('AIRTABLE_TOKEN / AIRTABLE_BASE_ID absents');
  if (!/^app[A-Za-z0-9]{14}$/.test(baseId)) throw new Error('AIRTABLE_BASE_ID invalide');

  const blocs = [];
  let offset;
  for (let page = 0; page < MAX_PAGES; page++) {
    const qs = new URLSearchParams({ returnFieldsByFieldId: 'true', pageSize: '100' });
    Object.values(F).forEach((id) => qs.append('fields[]', id));
    if (offset) qs.set('offset', offset);
    const res = await fetchImpl(`https://api.airtable.com/v0/${baseId}/${TABLE_ID}?${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Airtable HTTP ${res.status}`);
    const data = await res.json();
    (data.records || []).forEach((rec) => {
      const b = recordToBloc(rec, warn);
      if (b) blocs.push(b);
    });
    offset = data.offset;
    if (!offset) return blocs;
  }
  warn(`pagination interrompue après ${MAX_PAGES} pages`);
  return blocs;
}

module.exports = { TABLE_ID, FIELDS: F, recordToBloc, fetchBlocsFromAirtable };
