#!/usr/bin/env node
'use strict';
/**
 * Build Vercel (vercel-build) : copie vtc-project/public → dist-site/ puis
 * injecte les actions SEO validées (Airtable « Actions », statut Fait / Mesuré)
 * dans le HTML statique.
 *
 * Règle d'or : ce script ne doit JAMAIS casser le déploiement. Si Airtable est
 * absent, lent ou en erreur, les pages sont publiées telles quelles (exit 0).
 *
 * Variables de build : AIRTABLE_TOKEN (lecture seule), AIRTABLE_BASE_ID.
 * Option : SEO_BUILD_OUT=<dossier> pour changer la sortie (tests).
 */
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  try { require('dotenv').config({ path: '.env.local' }); } catch {}
  try { require('dotenv').config({ path: 'vtc-project/.env.local' }); } catch {}
}
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'vtc-project', 'public');
const OUT = path.resolve(ROOT, process.env.SEO_BUILD_OUT || 'dist-site');

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

async function fetchActiveBlocs() {
  const token = process.env.AIRTABLE_TOKEN || '';
  const baseId = process.env.AIRTABLE_BASE_ID || '';
  if (!token || !baseId) {
    console.warn('[seo-build] AIRTABLE_TOKEN / AIRTABLE_BASE_ID absents — pages publiées sans blocs.');
    return [];
  }
  const { fetchBlocsFromAirtable } = require('../lib/seo-airtable');
  return fetchBlocsFromAirtable({
    token,
    baseId,
    warn: (m) => console.warn(`[seo-build] ${m}`),
  });
}

async function main() {
  // 1. Copie brute : à partir d'ici, le site est toujours déployable.
  fs.rmSync(OUT, { recursive: true, force: true });
  copyDir(SRC, OUT);
  console.log(`[seo-build] ${path.relative(ROOT, SRC)} → ${path.relative(ROOT, OUT) || OUT}`);

  // 2. Lecture des blocs (tolérante aux pannes).
  let blocs = [];
  try {
    blocs = await fetchActiveBlocs();
    console.log(`[seo-build] ${blocs.length} bloc(s) actif(s) lu(s) dans Airtable.`);
  } catch (e) {
    console.warn(`[seo-build] Airtable indisponible (${e.message}) — pages publiées sans blocs.`);
    return;
  }
  if (!blocs.length) return;

  // 3. Injection page par page (une page en erreur garde sa version d'origine).
  const { BUILD_PAGES, applyBlocsToHtml } = require('../lib/seo-blocs');
  for (const [pagePath, file] of Object.entries(BUILD_PAGES)) {
    const target = path.join(OUT, file);
    try {
      const original = fs.readFileSync(target, 'utf8');
      const { html, applied, warnings } = applyBlocsToHtml(original, pagePath, blocs);
      warnings.forEach((w) => console.warn(`[seo-build] ${pagePath} : ${w}`));
      if (html !== original) {
        fs.writeFileSync(target, html);
        console.log(`[seo-build] ${pagePath} ← ${applied.join(', ')}`);
      }
    } catch (e) {
      console.warn(`[seo-build] ${pagePath} ignorée (${e.message}).`);
    }
  }
}

main().catch((e) => {
  // Filet de sécurité : on log, on ne casse pas le build.
  console.error('[seo-build] Erreur inattendue :', e && e.stack ? e.stack : e);
  if (!fs.existsSync(path.join(OUT, 'index.html'))) {
    try { copyDir(SRC, OUT); } catch {}
  }
}).finally(() => { process.exitCode = 0; });
