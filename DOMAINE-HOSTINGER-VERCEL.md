# 🌐 Connecter domaine Hostinger à Vercel

## 🎯 Objectif
Faire pointer `tondomaine.fr` (Hostinger) vers ton site Vercel au lieu de l'hébergement Hostinger classique.

---

## 📋 Étapes complètes

### **1. Ajouter le domaine dans Vercel (côté Vercel)**

#### A. Dashboard Vercel
1. Va sur [vercel.com/dashboard](https://vercel.com/dashboard)
2. Clique sur ton projet **`idvtc`**
3. Onglet **"Settings"** → **"Domains"**
4. Clique **"Add"**
5. Tape ton domaine : `tondomaine.fr` (remplace par ton vrai domaine)
6. Clique **"Add"**

#### B. Vercel te donnera des instructions
Vercel affichera quelque chose comme :
```
To configure your domain, add the following DNS records:

Type: CNAME
Name: @
Value: cname.vercel-dns.com

Type: CNAME  
Name: www
Value: cname.vercel-dns.com
```

**OU (selon la configuration) :**
```
Type: A
Name: @  
Value: 76.76.19.61

Type: CNAME
Name: www
Value: cname.vercel-dns.com
```

---

### **2. Configuration DNS chez Hostinger (côté domaine)**

#### A. Accès au panneau Hostinger
1. Connecte-toi sur [hostinger.fr](https://hostinger.fr)
2. **Panneau de contrôle** → **Domaines**
3. Clique sur **ton domaine** 
4. **"Gérer"** → **"Zone DNS"** ou **"DNS Records"**

#### B. Modifier les enregistrements DNS

**⚠️ IMPORTANT : Supprime d'abord les anciens enregistrements**

1. **Supprime** les enregistrements existants :
   - `A` pointant vers l'IP Hostinger (ex: 31.220.109.82)
   - `CNAME www` pointant vers l'hébergement Hostinger

2. **Ajoute** les nouveaux enregistrements Vercel :

**Option A - CNAME (recommandé) :**
```
Type: CNAME
Nom: @
Valeur: cname.vercel-dns.com
TTL: 300 (5 minutes)

Type: CNAME
Nom: www  
Valeur: cname.vercel-dns.com
TTL: 300
```

**Option B - A Record :**
```
Type: A
Nom: @
Valeur: 76.76.19.61
TTL: 300

Type: CNAME
Nom: www
Valeur: cname.vercel-dns.com  
TTL: 300
```

---

## 📊 Interface Hostinger - Exemple de configuration

Dans la **Zone DNS** Hostinger, tu devrais voir :

| Type | Nom | Valeur | TTL |
|------|-----|--------|-----|
| A | @ | 76.76.19.61 | 300 |
| CNAME | www | cname.vercel-dns.com | 300 |
| MX | @ | (garde tes emails si tu en as) | 3600 |

**Supprime tout le reste** (anciens A, CNAME vers Hostinger)

---

## ⏱️ Temps de propagation

### **Délais normaux :**
- **5-15 minutes** : propagation rapide
- **1-2 heures** : propagation complète 
- **24-48h max** : dans les cas extrêmes

### **Vérifications :**
- **[whatsmydns.net](https://www.whatsmydns.net)** → tape ton domaine pour voir la propagation mondiale
- **`nslookup tondomaine.fr`** en ligne de commande

---

## ✅ Résultat final

Une fois configuré :

- **`https://tondomaine.fr`** → Site Vercel (ton projet VTC)
- **`https://www.tondomaine.fr`** → Redirection automatique  
- **HTTPS automatique** → Certificat SSL gratuit Vercel
- **Performance** → CDN mondial Vercel

---

## 🆘 Problèmes fréquents

### **❌ "ERR_NAME_NOT_RESOLVED"**
→ DNS pas encore propagé, attendre 15-30 min

### **❌ "Site Hostinger" s'affiche encore**  
→ Cache navigateur, essaie en navigation privée

### **❌ "Certificate error"**
→ Vercel génère le SSL, attendre 5-10 min après DNS

### **❌ Site accessible en HTTP mais pas HTTPS**
→ Normal les premières minutes, Vercel génère le certificat

---

## 📞 Support

- **Vercel** : Chat support très réactif  
- **Hostinger** : Support DNS disponible 24/7
- **Vérification** : [dnschecker.org](https://dnschecker.org)

---

## 🎯 Checklist finale

- [ ] Domaine ajouté dans Vercel Dashboard
- [ ] DNS CNAME configurés chez Hostinger  
- [ ] Anciens enregistrements supprimés
- [ ] Propagation vérifiée (whatsmydns.net)
- [ ] Site accessible via le domaine
- [ ] HTTPS fonctionnel