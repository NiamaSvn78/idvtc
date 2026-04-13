const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

// Routes explicites pour les pages sans extension dans l'URL
const pages = [
  'a-propos',
  'faq',
  'chauffeur-prive-versailles',
  'chauffeur-prive-neuilly-sur-seine',
  'chauffeur-prive-boulogne-billancourt',
  'vtc-la-defense',
  'vtc-vincennes',
  'transfert-roissy-cdg',
  'transfert-orly-paris',
];
pages.forEach(slug => {
  app.get(`/${slug}`, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', `${slug}.html`));
  });
});

app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

app.listen(PORT, () => {
  console.log(`\n✅ Serveur démarré : http://localhost:${PORT}`);
  console.log(`   Ouvrir dans le navigateur : http://localhost:${PORT}\n`);
});
