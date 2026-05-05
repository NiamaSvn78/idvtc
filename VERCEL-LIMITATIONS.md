# ⚠️ Limitations Vercel - Stockage des données

## 🔴 Problème résolu
**Erreur `EROFS: read-only file system`** - Vercel ne permet pas d'écrire des fichiers sur le système de fichiers des fonctions serverless.

## ✅ Solution temporaire implémentée
- **Stockage en mémoire** sur Vercel (les données sont perdues à chaque redémarrage)
- **Stockage fichier local** en développement 
- **Détection automatique** de l'environnement

## 📊 Impact sur les fonctionnalités

### ✅ Fonctions qui marchent
- Site vitrine complet
- Formulaire de réservation (interface)
- Panel admin (interface) 
- Vérification de disponibilité en temps réel

### ⚠️ Limitations temporaires
- **Réservations perdues** au redémarrage/déploiement Vercel
- **Pas de persistance** des données admin
- **Stockage temporaire** uniquement

## 🚀 Solutions permanentes recommandées

### Option 1 : Vercel KV (Redis) - Recommandé
```bash
# Ajouter Vercel KV à ton projet
npm install @vercel/kv
```

### Option 2 : Vercel Postgres
```bash 
# Ajouter Vercel Postgres
npm install @vercel/postgres
```

### Option 3 : Base externe (Supabase/MongoDB)
```bash
# Exemple avec Supabase
npm install @supabase/supabase-js
```

### Option 4 : Firebase Firestore
```bash
npm install firebase-admin
```

## 🔧 Déploiement actuel

Le site fonctionne maintenant sur Vercel avec stockage en mémoire :
- ✅ **Aucune erreur 500**
- ✅ **Site accessible**
- ✅ **Réservations temporaires** (perdues au redémarrage)

## 📞 Migration vers base de données

Pour activer la persistance des données, choisis une option ci-dessus et je t'aide à l'implémenter.