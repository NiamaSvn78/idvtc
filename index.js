const express = require('express');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'vtc-project/public')));

// Simple in-memory storage
let reservations = [];

// Routes API
app.post('/api/reservations', (req, res) => {
  const reservation = {
    ...req.body,
    id: 'IDVTC-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
    createdAt: new Date().toISOString()
  };
  reservations.push(reservation);
  console.log('New reservation:', reservation.id);
  res.json({ success: true, ref: reservation.id });
});

app.get('/api/reservations', (req, res) => {
  const { pwd } = req.query;
  if (pwd !== 'idvtc2024') {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  res.json(reservations);
});

app.post('/api/check-availability', (req, res) => {
  res.json({ available: true });
});

// Serve HTML pages
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

// Default route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'vtc-project', 'public', 'index.html'));
});

// Export for Vercel
module.exports = app;

// Local development
if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}