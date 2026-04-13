# ID VTC — Site de Réservation

## 🚀 Lancer en local (2 façons)

### Option A — Node.js + Express (recommandé)
```bash
npm install
npm start
```
→ Ouvrir : http://localhost:3000

### Option B — Sans installation
```bash
npx serve public
```
→ Ouvrir l'URL affichée dans le terminal

---

## ⚙️ Configuration

Modifier les variables dans `public/index.html` (début du script JS) :

```js
const CFG = {
  STRIPE_PK: 'pk_live_...', // ← Votre clé Stripe
  tarifs: {
    business: { km: 3.20, base: 15, min: 35, h: 75 },
    van:      { km: 4.10, base: 20, min: 50, h: 95 }
  }
};
```

---

## 💳 Activer le vrai paiement Stripe

1. Créer un compte sur [stripe.com](https://stripe.com)
2. Récupérer votre clé publique `pk_live_...`
3. La coller dans `CFG.STRIPE_PK`
4. Créer un endpoint `/api/payment-intent` sur votre serveur (voir `server.js`)
5. Décommenter le bloc Stripe dans la fonction `doPay()`

---

## 🗺️ APIs utilisées (gratuites, sans clé)

| API | Usage |
|-----|-------|
| `api-adresse.data.gouv.fr` | Autocomplétion des adresses françaises |
| `router.project-osrm.org` | Calcul de distance par la route |

Ces APIs fonctionnent parfaitement sur `localhost` et en production.

---

## 📁 Structure

```
vtc-project/
├── public/
│   └── index.html     ← Page principale (tout en un seul fichier)
├── server.js          ← Serveur Express simple
├── package.json
└── README.md
```
