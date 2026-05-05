# 📧 Fonctionnalités Marketing - Base de données requise

## 🔴 Pourquoi une BDD est nécessaire ?

### **Problèmes actuels (stockage mémoire Vercel) :**
- ❌ **Réservations perdues** au redémarrage → impossible d'envoyer les confirmations
- ❌ **Contacts clients perdus** → pas de relance possible
- ❌ **Historique inexistant** → pas de segmentation marketing

### **Avantages avec une vraie BDD :**
- ✅ **Persistance garantie** des données clients
- ✅ **Envoi automatique** des confirmations
- ✅ **Campagnes marketing** ciblées
- ✅ **Conformité RGPD** (désinscription, historique)

---

## 📊 Fonctionnalités marketing possibles

### **1. Mails de confirmation automatiques**
```javascript
// Lors d'une réservation
await sendConfirmationEmail({
  clientEmail: "client@example.com",
  reservationRef: "IDVTC-123",
  details: { date, time, trajet, prix }
});
```

### **2. Relances marketing segmentées**
- **Nouveaux clients** → Mail de bienvenue + code promo
- **Clients réguliers** → Offres fidélité  
- **Clients inactifs** → Campagne de réactivation
- **Transferts aéroports** → Promos vacances

### **3. Campagnes saisonnières**
- **Rentrée** → Trajets business
- **Vacances** → Transferts aéroports  
- **Fêtes** → Mise à disposition soirées
- **Soldes** → Réductions temporaires

---

## 🛠️ Solutions techniques recommandées

### **Option 1 : Vercel KV (Redis) - Simple et gratuit**
✅ **Avantages :**
- Gratuit jusqu'à 30k requêtes/mois
- Intégration native Vercel
- Performances excellentes
- Configuration en 2 minutes

❌ **Inconvénients :**
- Pas de requêtes SQL complexes
- Stockage clé-valeur uniquement

### **Option 2 : Vercel Postgres - Complet**
✅ **Avantages :**
- Base relationnelle complète
- Requêtes SQL avancées
- Jointures, index, etc.
- Parfait pour du marketing data-driven

❌ **Inconvénients :**
- Payant après 60h/mois
- Plus complexe à configurer

### **Option 3 : Supabase - Recommandée pour marketing**
✅ **Avantages :**
- **Gratuit** jusqu'à 50k utilisateurs
- **PostgreSQL** complet
- **API automatique**  
- **Auth** intégrée
- **Real-time** 
- Parfait pour CRM/marketing

---

## 📈 Exemples de campagnes marketing

### **Segmentation clients :**
```sql
-- Clients premium (>500€ dépensés)
SELECT email FROM clients WHERE total_spent > 500;

-- Clients aéroports uniquement  
SELECT email FROM clients WHERE reservations LIKE '%CDG%' OR '%Orly%';

-- Inactifs depuis 6 mois
SELECT email FROM clients WHERE last_booking < NOW() - INTERVAL '6 months';
```

### **Templates d'emails :**
- **Confirmation** : "Votre réservation IDVTC-123 est confirmée"
- **Rappel J-1** : "N'oubliez pas votre trajet demain à 15h"  
- **Feedback** : "Comment s'est passé votre trajet ?"
- **Promo** : "20% sur les transferts aéroports ce mois-ci"

---

## 🎯 Plan d'implémentation

### **Phase 1 : Base technique (1-2h)**
1. Configurer Supabase ou Vercel Postgres
2. Migrer les données actuelles
3. Tester les confirmations automatiques

### **Phase 2 : Marketing automation (2-3h)**
1. Segmentation clients  
2. Templates d'emails
3. Campagnes automatisées
4. Dashboard analytics

### **Phase 3 : Fonctionnalités avancées**
1. A/B testing des emails
2. Scoring de clients (valeur vie)
3. Recommandations personnalisées
4. Intégration CRM

---

## 💰 Coûts estimés

| Solution | Coût mensuel | Limites |
|----------|--------------|---------|
| **Vercel KV** | Gratuit | 30k requêtes |
| **Vercel Postgres** | Gratuit | 60h/mois |
| **Supabase** | Gratuit | 50k utilisateurs |
| **SendGrid** (emails) | Gratuit | 100 emails/jour |

**Total : 0€/mois** pour commencer !