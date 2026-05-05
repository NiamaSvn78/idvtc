const express = require('express');
const path = require('path');

// Stockage en mémoire simple
let memoryReservations = [];

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../vtc-project/public')));

// API simple pour les réservations
app.post('/api/reservations', (req, res) => {
  const reservation = {
    ...req.body,
    id: 'IDVTC-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
    createdAt: new Date().toISOString()
  };
  memoryReservations.push(reservation);
  res.json({ success: true, ref: reservation.id });
});

app.get('/api/reservations', (req, res) => {
  const { pwd } = req.query;
  if (pwd !== 'idvtc2024') return res.status(401).json({ error: 'Unauthorized' });
  res.json(memoryReservations);
});

app.post('/api/check-availability', (req, res) => {
  // Pour l'instant, toujours disponible
  res.json({ available: true });
});

// Pages
const pages = [
  'a-propos', 'faq', 'chauffeur-prive-versailles',
  'chauffeur-prive-neuilly-sur-seine', 'chauffeur-prive-boulogne-billancourt',
  'vtc-la-defense', 'vtc-vincennes', 'transfert-roissy-cdg', 'transfert-orly-paris'
];

pages.forEach(slug => {
  app.get(`/${slug}`, (req, res) => {
    res.sendFile(path.join(__dirname, `../vtc-project/public/${slug}.html`));
  });
});

// Fonction pour Vercel
module.exports = app;