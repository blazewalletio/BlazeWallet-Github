# 🔍 SUPABASE VERIFICATIE SAMENVATTING

**Datum**: $(date +"%Y-%m-%d %H:%M")

---

## 📊 OVERZICHT TABLES

### **GROOTSTE TABLES** (op basis van size):
1. **gas_history**: 1016 kB (3934 rows) - Actief gebruikt
2. **priority_list_registrations**: 160 kB (5 rows) - Actief gebruikt
3. **wallets**: 96 kB (5 rows) - Actief gebruikt
4. **ai_cache**: 144 kB (23 rows) - Actief gebruikt
5. **scheduled_transactions**: 144 kB (13 rows) - Actief gebruikt

### **LEGE TABLES** (0 rows):
- `admin_actions`: 32 kB (0 rows)
- `gas_alerts`: 40 kB (0 rows)
- `notifications`: 32 kB (0 rows)
- `recurring_sends`: 40 kB (0 rows)
- `transaction_savings`: 40 kB (0 rows)
- `user_savings`: 24 kB (0 rows) ⚠️ **OVERBODIG**
- `user_savings_stats`: 16 kB (0 rows)
- `wallet_sync_logs`: 32 kB (0 rows) ⚠️ **OVERBODIG**

### **ONVERWACHTE TABLE**:
- `audit_logs`: 40 kB (0 rows) - Niet in originele migratie lijst

---

## ⚠️ OVERBODIGE TABLES (100% ZEKER)

### **1. wallet_sync_logs**
- **Status**: 0 rows, 0 unique users
- **Size**: 32 kB (alleen indexes)
- **Reden**: Geen enkele query gebruikt deze table in de codebase
- **Aanbeveling**: ✅ **VERWIJDEREN**

### **2. user_savings**
- **Status**: 0 rows, 0 unique users, $0 saved
- **Size**: 24 kB (alleen indexes)
- **Reden**: Vervangen door `transaction_savings` + `user_savings_stats`
- **Aanbeveling**: ✅ **VERWIJDEREN**

---

## 🧹 STALE DATA (data die opgeruimd kan worden)

### **1. email_verification_tokens (expired)**
- **Aantal**: 3 tokens
- **Aanbeveling**: ✅ **OPRUIMEN** (veilig)

### **2. gas_history (old >7d)**
- **Aantal**: 520 rows
- **Status**: Auto-cleanup is al enabled
- **Aanbeveling**: ⚠️ **NIET HANDMATIG OPRUIMEN** (auto-cleanup doet dit al)

### **3. Overige stale data**
- `ai_cache (expired >7d)`: 0 rows ✅
- `notifications (read + old >30d)`: 0 rows ✅
- `wallet_sync_logs (old >30d)`: 0 rows ✅

---

## 📋 ACTIE ITEMS

### **✅ VEILIG OM TE VERWIJDEREN**:
1. **3 expired email verification tokens** - Veilig om op te ruimen
2. **wallet_sync_logs table** - 0 rows, niet gebruikt
3. **user_savings table** - 0 rows, vervangen door nieuwe tables

### **⚠️ NIET VERWIJDEREN** (maar checken):
- `audit_logs` table - Niet in originele migratie lijst, maar bestaat wel
- `gas_history` oude data - Auto-cleanup doet dit al automatisch

---

## 💾 TOTALE DATABASE SIZE

**Geschatte totale size**: ~2.5 MB (zeer klein, geen zorgen!)

**Grootste table**: `gas_history` (1016 kB) - Dit is normaal voor gas price tracking

---

## 🎯 VOLGENDE STAPPEN

1. ✅ **Review deze samenvatting**
2. ✅ **Run cleanup script** voor expired tokens (3 stuks)
3. ✅ **Verwijder overbodige tables** (`wallet_sync_logs`, `user_savings`)
4. ✅ **Check `audit_logs` table** - Waar komt deze vandaan?

---

**GENERATED**: $(date)
**STATUS**: ✅ Verificatie compleet - Ready for cleanup

