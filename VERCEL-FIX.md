# 🔧 Fix Vercel - Architecture simplifiée

## ❌ **Problème identifié**
- Configuration Vercel trop complexe (`builds`, `routes`)
- Import circulaire `index.js` → `vtc-project/server.js` 
- Dépendances manquantes (`nodemailer`, `crypto`)

## ✅ **Solution appliquée**

### **1. Architecture simplifiée**
```
/api/index.js          ← Point d'entrée Vercel unique
/vtc-project/public/   ← Fichiers statiques
/vercel.json           ← Configuration minimaliste
```

### **2. Configuration Vercel moderne**
```json
{
  "functions": {
    "api/index.js": {
      "runtime": "nodejs18.x"  
    }
  },
  "rewrites": [
    { "source": "/(.*)", "destination": "/api/" }
  ]
}
```

### **3. API minimaliste**
- ✅ **Réservations** (POST/GET)
- ✅ **Vérification dispo** (basique)
- ✅ **Pages statiques** servies
- ❌ **Supprimé** : emails, crypto, fichiers complexes

## 🚀 **Résultat attendu**
- ✅ **Pas d'erreur 500**
- ✅ **Site accessible** 
- ✅ **Formulaire fonctionnel** (réservations temporaires)
- ⚠️ **APIs simplifiées** (pas d'email auto pour l'instant)

## ⏱️ **Temps de déploiement**
**2-3 minutes** pour le redéploiement automatique Vercel.

## 🔄 **Prochaine étape**
Une fois le site accessible, on pourra rajouter progressivement :
- Emails de confirmation
- Vérifications avancées
- Base de données (plus tard)

---

**✨ Le site devrait être opérationnel sous peu !**