# 🚀 Déployment Vercel - Fonctionnalités complètes

## Étapes de déploiement

### 1. Installation Vercel CLI
```bash
npm install -g vercel
```

### 2. Se connecter à Vercel
```bash
vercel login
```

### 3. Déployer depuis le dossier racine
```bash
cd "c:\Users\NiamaD\Documents\IA et automatisation\idvtc"
vercel --prod
```

### 4. Configuration lors du premier déploiement
- **Set up and deploy?** → `Y`
- **Which scope?** → Choisis ton compte
- **Link to existing project?** → `N` 
- **Project name?** → `idvtc` (ou garde le nom proposé)
- **Directory with code?** → `.` (dossier actuel)
- **Build Command?** → `npm run build`
- **Output Directory?** → `.` (laisser vide)
- **Development Command?** → `npm run dev`

## ⚙️ Variables d'environnement (optionnel)

Pour les emails automatiques, configure dans Vercel Dashboard :
```env
ADMIN_PWD=tonmotdepasse123
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tonemail@gmail.com
SMTP_PASS=tonmotdepasseemail
SMTP_FROM=tonemail@gmail.com
APP_URL=https://ton-projet.vercel.app
```

## 🔄 Déploiements futurs

Une fois configuré, chaque `git push` redéploie automatiquement !

```bash
git add -A
git commit -m "Mise à jour site"
git push origin main
# → Vercel redéploie automatiquement
```

## 🎯 Résultat

Tu auras :
- ✅ **Réservations en ligne** fonctionnelles
- ✅ **Panel admin** (https://ton-site.vercel.app/admin)
- ✅ **API** complète (prix, disponibilités)
- ✅ **Domaine gratuit** (.vercel.app)
- ✅ **HTTPS** automatique
- ✅ **Déploiement automatique** depuis GitHub

## 🌐 Domaine personnalisé (optionnel)

Dans Vercel Dashboard → Settings → Domains → Add ton domaine.