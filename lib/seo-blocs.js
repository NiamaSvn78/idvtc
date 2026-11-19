'use strict';
/**
 * Blocs SEO validés (Airtable « Actions », statut Fait / Mesuré), injectés au
 * build par scripts/build-seo-pages.js dans le HTML statique. La lecture
 * Airtable est dans lib/seo-airtable.js.
 */
const { marked } = require('marked');
const sanitizeHtml = require('sanitize-html');

/* Pages éligibles : chemin public → fichier HTML dans vtc-project/public.
   Chaque fichier doit contenir les balises <!-- seo:contenu -->…<!-- /seo:contenu -->
   et <!-- seo:extra -->. Toute autre page cible est ignorée au build. */
const SEO_PAGES = {
  '/': 'index.html',
  '/chauffeur-prive-versailles': 'chauffeur-prive-versailles.html',
  '/chauffeur-prive-neuilly-sur-seine': 'chauffeur-prive-neuilly-sur-seine.html',
  '/chauffeur-prive-boulogne-billancourt': 'chauffeur-prive-boulogne-billancourt.html',
  '/vtc-la-defense': 'vtc-la-defense.html',
  '/vtc-vincennes': 'vtc-vincennes.html',
  '/transfert-roissy-cdg': 'transfert-roissy-cdg.html',
  '/transfert-orly-paris': 'transfert-orly-paris.html',
  '/cdg-airport-transfer-paris': 'cdg-airport-transfer-paris.html',
  '/orly-airport-transfer-paris': 'orly-airport-transfer-paris.html',
};

/* Pages qui peuvent seulement recevoir l'encart « À voir aussi » (balise
   <!-- seo:extra --> uniquement) : jamais page cible d'un bloc. */
const LINK_ONLY_PAGES = {
  '/faq': 'faq.html',
  '/a-propos': 'a-propos.html',
};

/* Toutes les pages traitées au build (cibles + sources de liens). */
const BUILD_PAGES = { ...SEO_PAGES, ...LINK_ONLY_PAGES };

const SEO_TYPES = ['Contenu', 'Maillage & enrichissement', 'Title/Meta', 'Défense'];
const SITE_HOSTS = ['ismadrive.fr', 'www.ismadrive.fr'];

const MARK_CONTENU_RE = /<!-- seo:contenu -->[\s\S]*?<!-- \/seo:contenu -->/;
const MARK_EXTRA = '<!-- seo:extra -->';

/**
 * URL complète (ou chemin) → chemin normalisé, ou null si hors site.
 * "https://www.ismadrive.fr/chauffeur-prive-versailles/" → "/chauffeur-prive-versailles"
 */
function normalizePagePath(input) {
  const raw = String(input || '').trim();
  if (!raw) return null;
  let url;
  try {
    url = raw.startsWith('/') && !raw.startsWith('//')
      ? new URL(raw, 'https://ismadrive.fr')
      : new URL(raw);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(url.protocol)) return null;
  if (!SITE_HOSTS.includes(url.hostname.toLowerCase())) return null;
  let p;
  try { p = decodeURIComponent(url.pathname); } catch { return null; }
  p = p.replace(/\/+$/, '').replace(/\.html$/, '');
  return p || '/';
}

/** Page cible d'un bloc (page_path) : les 10 pages SEO. */
function isKnownPage(pagePath) {
  return Object.prototype.hasOwnProperty.call(SEO_PAGES, pagePath);
}

/** Page source d'une ligne « liens » : pages SEO + FAQ + À propos. */
function isLinkSourcePage(pagePath) {
  return Object.prototype.hasOwnProperty.call(BUILD_PAGES, pagePath);
}

/* ── Markdown → HTML nettoyé ── */

function isInternalHref(href) {
  return typeof href === 'string' && /^\/(?!\/)/.test(href) && !/[\s\\]/.test(href);
}

const SANITIZE_BLOCK = {
  allowedTags: ['h2', 'h3', 'p', 'ul', 'ol', 'li', 'strong', 'em', 'a'],
  allowedAttributes: { a: ['href'] },
  allowedSchemes: [],
  allowedSchemesAppliedToAttributes: [],
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard',
  transformTags: {
    h1: 'h2',
    h4: 'h3', h5: 'h3', h6: 'h3',
    b: 'strong', i: 'em',
    // Lien non interne → on garde le texte, on retire la balise.
    a: (tagName, attribs) => (isInternalHref(attribs.href)
      ? { tagName: 'a', attribs: { href: attribs.href } }
      : { tagName: 'span', attribs: {} }),
  },
};
const SANITIZE_INLINE = { ...SANITIZE_BLOCK, allowedTags: ['strong', 'em', 'a'] };

function mdToHtml(md) {
  if (!md || !String(md).trim()) return '';
  const html = marked.parse(String(md), { async: false, gfm: true, breaks: false });
  return sanitizeHtml(html, SANITIZE_BLOCK).trim();
}

function mdInlineToHtml(md) {
  if (!md || !String(md).trim()) return '';
  const html = marked.parseInline(String(md).trim(), { async: false, gfm: true });
  return sanitizeHtml(html, SANITIZE_INLINE).trim();
}

/** "liens" → [{ source: '/page', phrase: '...' }] (lignes invalides ignorées). */
function parseLiens(text) {
  const out = [];
  String(text || '').split(/\r?\n/).forEach((line) => {
    const i = line.indexOf('|');
    if (i < 0) return;
    const source = normalizePagePath(line.slice(0, i));
    const phrase = line.slice(i + 1).trim();
    if (source && isLinkSourcePage(source) && phrase) out.push({ source, phrase });
  });
  return out;
}

/* ── Injection dans le HTML statique ── */

function escAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function ts(v) {
  const t = Date.parse(v);
  return Number.isNaN(t) ? 0 : t;
}

/* Date faite (jour) puis heure de création Airtable pour départager un même jour. */
function byOldestFirst(a, b) {
  return (ts(a.created_at) - ts(b.created_at))
    || (ts(a.created_time) - ts(b.created_time))
    || String(a.action_id).localeCompare(String(b.action_id));
}

/**
 * Calcule ce qui s'affiche sur une page à partir de TOUS les blocs actifs
 * (les "liens" d'un bloc peuvent viser une autre page que la sienne).
 */
function planForPage(pagePath, allBlocs) {
  const sorted = [...allBlocs].sort(byOldestFirst);
  // FAQ / À propos : jamais cibles d'un bloc, seulement de l'encart « À voir aussi ».
  const own = isKnownPage(pagePath) ? sorted.filter((b) => b.page_path === pagePath) : [];
  const newest = (pred) => own.filter(pred).pop() || null;

  const titleBloc = newest((b) => b.title && b.title.trim());
  const metaBloc = newest((b) => b.meta && b.meta.trim());
  const contenuBloc = newest((b) => b.type === 'Contenu' && b.bloc_md && b.bloc_md.trim());
  const extras = own.filter((b) => (b.type === 'Maillage & enrichissement' || b.type === 'Défense')
    && b.bloc_md && b.bloc_md.trim());

  const seen = new Set();
  const liens = [];
  sorted.forEach((b) => {
    parseLiens(b.liens).forEach(({ source, phrase }) => {
      if (source !== pagePath) return;
      const html = mdInlineToHtml(phrase);
      const key = html.replace(/\s+/g, ' ').toLowerCase();
      if (!html || seen.has(key)) return;
      seen.add(key);
      liens.push(html);
    });
  });

  return {
    title: titleBloc ? titleBloc.title.trim() : null,
    meta: metaBloc ? metaBloc.meta.trim() : null,
    contenu: contenuBloc,
    extras,
    liens,
  };
}

const SEO_STYLE = '<style id="seo-blocs-css">'
  + '.seo-bloc ul,.seo-bloc ol{margin:0 0 1rem 1.2rem}.seo-bloc li{margin:.3rem 0}'
  + '.seo-bloc a,.seo-voir-aussi a{color:var(--gold,#c9a96e)}'
  + '.seo-voir-aussi{margin:2.5rem 0 1rem;padding:1.4rem 1.6rem;border:1px solid var(--gold-border,rgba(201,169,110,.25))}'
  + '.seo-voir-aussi ul{list-style:none;margin:0;padding:0}.seo-voir-aussi li{margin:.5rem 0}'
  + '.seo-home{max-width:900px;margin:0 auto;padding:4rem 1.5rem}'
  + '.seo-home h2{font-family:"Cormorant Garamond",serif;font-weight:300;font-size:clamp(1.6rem,3vw,2.2rem);margin:0 0 1rem}'
  + '.seo-home h3{margin:1.5rem 0 .6rem}.seo-home p{line-height:1.8;margin:0 0 1rem}'
  + '</style>';

/**
 * Injecte les blocs dans le HTML d'une page.
 * @returns {{ html: string, applied: string[], warnings: string[] }}
 */
function applyBlocsToHtml(html, pagePath, allBlocs) {
  const plan = planForPage(pagePath, allBlocs);
  const applied = [];
  const warnings = [];
  const isHome = pagePath === '/';
  // Bascule FR/EN : seulement sur les pages qui chargent i18n.js.
  const bilingual = /<script src="\/js\/i18n\.js/.test(html);
  const dict = { fr: {}, en: {} };
  let n = 0;

  const renderBloc = (b) => {
    const fr = mdToHtml(b.bloc_md);
    if (!fr) return '';
    if (!bilingual) return `<div class="seo-bloc">${fr}</div>`;
    const en = mdToHtml(b.bloc_en) || fr; // bloc_en vide → FR dans les deux langues
    const key = `seo_bloc.${n++}`;
    dict.fr[key] = fr;
    dict.en[key] = en;
    return `<div class="seo-bloc" data-i18n-html="${key}">${fr}</div>`;
  };

  /* title / meta (+ Open Graph / Twitter s'ils existent).
     Toujours des fonctions de remplacement : un « $& » ou « $' » venu de Make
     ne doit jamais être interprété par String.replace. */
  if (plan.title) {
    const t = escAttr(plan.title);
    html = html.replace(/<title>[\s\S]*?<\/title>/, () => `<title>${t}</title>`)
      .replace(/(<meta (?:property|name)="(?:og|twitter):title" content=")[^"]*(")/g, (_, a, b) => a + t + b);
    applied.push('title');
  }
  if (plan.meta) {
    const m = escAttr(plan.meta);
    if (/<meta name="description" content="[^"]*">/.test(html)) {
      html = html.replace(/(<meta name="description" content=")[^"]*(")/, (_, a, b) => a + m + b);
    } else {
      html = html.replace('</title>', () => `</title>\n<meta name="description" content="${m}">`);
    }
    html = html.replace(/(<meta (?:property|name)="(?:og|twitter):description" content=")[^"]*(")/g, (_, a, b) => a + m + b);
    applied.push('meta');
  }

  // On ne rend (et ne traduit) que ce qui a une balise où se placer.
  const hasContenu = MARK_CONTENU_RE.test(html);
  const hasExtra = html.includes(MARK_EXTRA);
  const canContenu = isHome ? hasContenu && hasExtra : hasContenu;
  const canExtra = isHome ? hasContenu && hasExtra : hasExtra;
  if (plan.contenu && !canContenu) warnings.push('balise seo:contenu absente — contenu ignoré');
  if ((plan.extras.length || plan.liens.length) && !canExtra) warnings.push('balise seo:extra absente — blocs ajoutés / liens ignorés');

  const contenuHtml = plan.contenu && canContenu ? renderBloc(plan.contenu) : '';
  const extrasHtml = canExtra ? plan.extras.map(renderBloc).filter(Boolean).join('\n') : '';
  const liensHtml = canExtra && plan.liens.length
    ? `<aside class="seo-voir-aussi"><h2>À voir aussi</h2><ul>${plan.liens.map((l) => `<li>${l}</li>`).join('')}</ul></aside>`
    : '';
  if (contenuHtml) applied.push('contenu');
  if (extrasHtml) applied.push(`extras×${plan.extras.length}`);
  if (liensHtml) applied.push(`liens×${plan.liens.length}`);

  if (!contenuHtml && !extrasHtml && !liensHtml) {
    // rien à placer
  } else if (isHome) {
    // Accueil : nouvelle section après le hero, rien n'est remplacé.
    const body = [contenuHtml, extrasHtml, liensHtml].filter(Boolean).join('\n');
    const section = body ? `<section class="seo-home" id="seo-contenu">\n${body}\n</section>` : '';
    html = html.replace(MARK_CONTENU_RE, (m) => m.replace(/-->[\s\S]*<!--/, () => `-->${section}<!--`));
  } else {
    if (contenuHtml) {
      html = html.replace(MARK_CONTENU_RE, () => `<!-- seo:contenu -->\n${contenuHtml}\n<!-- /seo:contenu -->`);
    }
    const tail = [extrasHtml, liensHtml].filter(Boolean).join('\n');
    if (tail) html = html.replace(MARK_EXTRA, () => `${MARK_EXTRA}\n${tail}`);
  }

  const changedBody = contenuHtml || extrasHtml || liensHtml;
  if (changedBody && !html.includes('id="seo-blocs-css"')) {
    html = html.replace('</head>', () => `${SEO_STYLE}\n</head>`);
  }
  if (bilingual && n > 0) {
    // Même mécanisme que le reste du site (data-i18n-html) : i18n.js fusionne
    // ce dictionnaire dans ses traductions. JSON non exécutable → compatible CSP.
    const json = JSON.stringify(dict).replace(/</g, '\\u003c');
    html = html.replace(/<script src="\/js\/i18n\.js/,
      () => `<script type="application/json" id="i18n-seo">${json}</script>\n<script src="/js/i18n.js`);
  }
  return { html, applied, warnings };
}

module.exports = {
  SEO_PAGES,
  LINK_ONLY_PAGES,
  BUILD_PAGES,
  SEO_TYPES,
  normalizePagePath,
  isKnownPage,
  isLinkSourcePage,
  mdToHtml,
  mdInlineToHtml,
  parseLiens,
  planForPage,
  applyBlocsToHtml,
};
