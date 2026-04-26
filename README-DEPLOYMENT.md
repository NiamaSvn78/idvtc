# Déploiement VTC sur Hostinger

## 🔴 Problème résolu
**Erreur 403** causée par :
- Structure incorrecte (index.html dans sous-dossier)
- Node.js non supporté sur Hostinger basique

## ✅ Solution : Version statique

### 1. Générer la version statique
```bash
node scripts/build-static.js
```

### 2. Upload sur Hostinger
1. Connecte-toi à **Hostinger File Manager** ou **FTP**
2. Aller dans le dossier `public_html/` de ton domaine  
3. **Supprimer tout** le contenu actuel
4. **Upload tout** le contenu de `/build-static/` vers `public_html/`

### 3. Configuration requise
- ✅ `.htaccess` inclus (URLs propres)
- ⚠️ **Modifier les contacts** dans `index.html` :
  - Remplace `+33 6 XX XX XX XX` par ton vrai numéro
  - Remplace `contact@ismadrive.fr` par ton email

### 4. Fonctionnalités
- ✅ Site vitrine complet
- ✅ SEO optimisé  
- ✅ URLs propres (`/faq`, `/a-propos`, etc.)
- ❌ Réservation en ligne (remplacée par contact direct)

## 🚀 Alternative : Hébergeur Node.js

Pour garder les réservations en ligne, utilise :
- **Vercel** (gratuit) : `vercel --prod`
- **Railway** : déploiement GitHub automatique  
- **Render** : plan gratuit disponible

### Deploy sur Vercel (recommandé)
```bash
npm install -g vercel
cd vtc-project  
vercel --prod
```

## 📁 Structure finale Hostinger
```
public_html/
├── index.html          # Page d'accueil
├── .htaccess           # URLs propres
├── faq.html
├── a-propos.html
├── photo_pro.png
└── [autres pages...]
```