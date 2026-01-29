# 🔍 BLAZE ADMIN - GEVONDEN PROBLEMEN

## ❌ KRITIEKE ISSUES

### 1. USER DATA - Email ontbreekt
**Probleem:**
- Admin API probeert `profile.email` op te halen
- Maar `user_profiles` tabel heeft GEEN email column
- Email zit in `auth.users` (Supabase auth tabel)

**Fix:** 
- Join met auth.users OF
- Haal email op via Supabase auth API

**Locatie:**
`apps/admin/app/api/admin/users/route.ts` line 66

---

### 2. USERNAME DISPLAY - Altijd "BLAZE User"
**Probleem:**
- `user_profiles.display_name` is NULL of "BLAZE User"
- Users stellen hun username in via wallet app
- Maar dit wordt niet opgeslagen in user_profiles!

**Echte data:**
```json
{
  "display_name": "BLAZE User",  // ❌ Default value
  "display_name": null            // ❌ Not set
}
```

**Fix:**
- Check waar username wordt gezet in wallet app
- Zorg dat het naar user_profiles.display_name wordt gesaved
- Of check of er een andere tabel is voor usernames

---

### 3. ACTIVE USERS - Toont 0
**Probleem:**
- Analytics API probeert waarschijnlijk iets dat niet bestaat
- Moet user_events tellen met recent created_at

**Oplossing:**
```sql
SELECT COUNT(DISTINCT user_id) 
FROM user_events 
WHERE created_at >= NOW() - INTERVAL '30 days'
```

---

### 4. USER BALANCES - Allemaal $0
**Probleem:**
- Admin probeert balances op te halen
- Maar balances worden NIET opgeslagen in database!
- Wallet app calculeert balances on-the-fly via blockchain APIs

**Mogelijke oplossingen:**
A) Admin moet zelf blockchain queries doen (slow!)
B) Cache balances in database (requires wallet app update)
C) Toon alleen wallets/addresses, geen balances

---

### 5. TRANSACTION DATA - Leeg
**Probleem:**
- `transaction_events` tabel is compleet LEEG
- Transacties worden waarschijnlijk niet getracked

**Impact:**
- Geen transaction history in admin
- Geen transaction analytics
- Geen volume data

**Fix:**
- Implementeer transaction tracking in wallet app
- Elke send/receive moet gelogd worden

---

## 📊 DATABASE STRUCTUUR (ECHTE DATA)

### Tabellen die BESTAAN:
✅ `user_profiles` - User info (maar zonder email!)
✅ `user_events` - Activity tracking  
✅ `wallets` - Encrypted wallets
✅ `transaction_events` - LEEG!
✅ `onramp_transactions` - Onramp data
✅ `user_cohorts` - User segments

### Tabellen die NIET BESTAAN:
❌ `users` - Admin code verwacht deze!
❌ `transactions` - Admin code verwacht deze!

---

## 🔧 PRIORITEIT FIXES

### HIGH PRIORITY:
1. **Fix email** - Haal op uit auth.users
2. **Fix username** - Implementeer username save in wallet
3. **Fix active users** - Correct query op user_events

### MEDIUM PRIORITY:
4. **Balances** - Besluit: real-time via API of cache?
5. **Transaction tracking** - Implementeer in wallet app

### LOW PRIORITY:
6. **Analytics** - Fix alle queries voor correcte tabellen
7. **Cohorts** - Implement user segmentation logic

---

## 🧪 TESTING PLAN

1. Test GET /api/admin/users
2. Test GET /api/admin/analytics/overview  
3. Test GET /api/admin/users/[userId]
4. Test balances endpoint
5. Verify UI toont correcte data

