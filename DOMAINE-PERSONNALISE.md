# 🌐 Connecter ton domaine à Vercel

## Étapes après déploiement

### 1. Accéder au Dashboard Vercel
1. Va sur [vercel.com/dashboard](https://vercel.com/dashboard)
2. Clique sur ton projet `idvtc`
3. Va dans l'onglet **"Settings"**
4. Clique sur **"Domains"** dans le menu de gauche

### 2. Ajouter ton domaine
1. Clique sur **"Add"** 
2. Entre ton domaine : `tondomaine.fr` 
3. Clique sur **"Add"**

### 3. Configuration DNS (chez ton registrar)

Vercel va te donner des instructions DNS. Tu auras **2 options** :

#### Option A : CNAME (recommandé)
```
Type: CNAME
Name: @ (ou www)
Value: cname.vercel-dns.com
```

#### Option B : A Record
```
Type: A  
Name: @
Value: 76.76.19.61
```

### 4. Configurer les DNS
Va chez ton **registrar de domaine** (OVH, Namecheap, GoDaddy, etc.) :

1. **Panneau DNS** → **Zone DNS**
2. **Supprimer** les anciens enregistrements A/CNAME pour `@` et `www`
3. **Ajouter** les nouveaux enregistrements Vercel

#### Exemple configuration DNS complète :
```
@ (root)     CNAME    cname.vercel-dns.com
www          CNAME    cname.vercel-dns.com
```

### 5. Vérification
- **Propagation DNS** : 5-60 minutes
- **Certificat SSL** : automatique Vercel
- **Test** : `https://tondomaine.fr`

## 🚀 Résultat final

✅ **`https://tondomaine.fr`** → Site complet avec réservations  
✅ **`https://tondomaine.fr/admin`** → Panel admin  
✅ **HTTPS automatique** (certificat SSL)  
✅ **Performance optimale** (CDN mondial)

## ⚠️ Notes importantes

- **Temps de propagation** : peut prendre jusqu'à 24h dans certains cas
- **Certificat SSL** : généré automatiquement par Vercel
- **Redirection www** : automatique si configurée
- **Ancien site** : sera remplacé par le nouveau

## 🆘 Si ça ne marche pas

1. Vérifier les DNS : [whatsmydns.net](https://www.whatsmydns.net)
2. Purger le cache DNS : `ipconfig /flushdns` (Windows)
3. Support Vercel : très réactif sur leur chat