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

## ⚙️ Variables d'environnement

### Confirmation par email (Resend)

Après une réservation, l’API envoie la confirmation avec le **QR code** (même contenu que sur la modale) uniquement si un email valide est fourni. Configure dans Vercel → **Settings** → **Environment Variables** :

```env
RESEND_API_KEY=re_xxxxxxxx
RESEND_FROM_EMAIL=booking@ton-domaine-verifie.fr
RESEND_BCC_EMAIL=contact@ismadrive.fr
```

- **RESEND_API_KEY** : clé API depuis le tableau de bord [Resend](https://resend.com/api-keys).
- **RESEND_FROM_EMAIL** : adresse d’expéditeur **vérifiée** dans Resend (domaine ou email de test selon ton plan).
- **RESEND_BCC_EMAIL** *(recommandé)* : ton adresse pro (ex. `contact@ismadrive.fr`). Tu reçois une **copie invisible** de chaque confirmation client — même contenu + QR, **sans base de données**, historique dans ta messagerie. Laisse vide si tu ne veux pas de copie. Si le client met la même adresse que le BCC, la copie est ignorée pour éviter un doublon.

Sans ces variables, la réservation reste enregistrée mais `emailSent` sera `false` et le client verra un message d’échec d’envoi sur la modale.

### Autres (si utilisées ailleurs)

```env
APP_URL=https://ton-projet.vercel.app
```

Le projet cible **Node 20+** (requis par le SDK Resend). Dans Vercel → **Settings** → **General** → **Node.js Version**, choisis **20.x** ou supérieur.

### Site inaccessible après déploiement

1. **Répertoire racine du projet Vercel** : dans **Settings → General → Root Directory**, la valeur doit être **vide** (ou `.`) pour utiliser la racine du dépôt où se trouvent `index.js` et `vtc-project/`. Si tu mets par exemple `vtc-project` seul, `index.js` ne sera pas trouvé.

2. **Fichiers statiques** : le fichier `vercel.json` inclut `includeFiles` pour empaqueter `vtc-project/public` dans la fonction Node. Sans cela, les pages HTML ne sont pas sur le disque de la fonction → erreurs **500** ou page blanche.

3. Regarde les **logs** de la fonction dans Vercel (**Deployments → ton déploiement → Functions → index.js → Logs**) si le problème persiste.

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