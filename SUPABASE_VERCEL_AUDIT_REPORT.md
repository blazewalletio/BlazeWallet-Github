# 🔍 BLAZE WALLET - SUPABASE & VERCEL AUDIT RAPPORT
**Datum**: $(date +"%Y-%m-%d %H:%M")
**Project**: Blaze Wallet (ldehmephukevxumwdbwt)

---

## 📊 SUPABASE DATABASE AUDIT

### ✅ VERWACHTE TABLES (van migrations):

#### **Migration 01: Wallets**
- ✅ `wallets` - Encrypted wallet storage (ACTIEF)
- ✅ `wallet_sync_logs` - Sync history (OPTIONEEL, debugging)

#### **Migration 03: AI Assistant Cache**
- ✅ `ai_cache` - AI response caching (ACTIEF)
- ✅ `ai_rate_limits` - Rate limiting (ACTIEF)

#### **Migration 04: Gas Optimizer**
- ✅ `gas_history` - Historical gas prices (ACTIEF)
- ✅ `gas_alerts` - User gas alerts (ACTIEF)
- ✅ `scheduled_transactions` - Scheduled txs (ACTIEF)
- ✅ `user_savings` - Savings tracking (ACTIEF)

#### **Migration 05: Smart Scheduler**
- ⚠️ `scheduled_transactions` - **DUPLICAAT!** (ook in migration 04)
- ✅ `recurring_sends` - Recurring payments (ACTIEF)
- ⚠️ `gas_alerts` - **DUPLICAAT!** (ook in migration 04)
- ✅ `transaction_savings` - Per-transaction savings (ACTIEF)
- ✅ `user_savings_stats` - Aggregated stats (ACTIEF)
- ✅ `notifications` - In-app notifications (ACTIEF)

#### **Migration 06: Gas Collection Scheduler**
- ⚠️ **Geen nieuwe tables** - Alleen pg_cron setup

#### **Priority List (supabase-schema.sql)**
- ✅ `priority_list_registrations` - Priority list signups (ACTIEF)
- ✅ `admin_actions` - Admin audit log (ACTIEF)
- ✅ `email_verification_tokens` - Email verification (ACTIEF)

---

### ⚠️ POTENTIËLE PROBLEMEN:

#### **1. DUPLICATE TABLES**
- `scheduled_transactions` bestaat in **2 migrations** (04 + 05)
- `gas_alerts` bestaat in **2 migrations** (04 + 05)
- **RISICO**: Schema conflicts, duplicate columns, migration errors

#### **2. MOGELIJK OVERBODIGE TABLES**

**`wallet_sync_logs`**:
- ❓ **Status**: ONBEKEND (mogelijk niet gebruikt)
- 📝 **Gebruik**: Alleen voor debugging
- 💡 **Aanbeveling**: Check of deze daadwerkelijk wordt gebruikt

**`user_savings`** (migration 04):
- ⚠️ **Mogelijk overbodig** - `user_savings_stats` (migration 05) doet hetzelfde
- 💡 **Aanbeveling**: Check of beide nodig zijn

---

### 📋 TABLES OVERZICHT:

| Table | Migration | Status | Rows | Gebruik |
|-------|-----------|--------|------|---------|
| `wallets` | 01 | ✅ ACTIEF | ? | Email login wallets |
| `wallet_sync_logs` | 01 | ❓ ONBEKEND | ? | Debugging only? |
| `ai_cache` | 03 | ✅ ACTIEF | ? | AI response cache |
| `ai_rate_limits` | 03 | ✅ ACTIEF | ? | Rate limiting |
| `gas_history` | 04 | ✅ ACTIEF | ? | Gas price history |
| `gas_alerts` | 04+05 | ⚠️ DUPLICAAT | ? | Gas alerts |
| `scheduled_transactions` | 04+05 | ⚠️ DUPLICAAT | ? | Scheduled txs |
| `user_savings` | 04 | ❓ MOGELIJK OVERBODIG | ? | Savings tracking |
| `recurring_sends` | 05 | ✅ ACTIEF | ? | Recurring payments |
| `transaction_savings` | 05 | ✅ ACTIEF | ? | Per-tx savings |
| `user_savings_stats` | 05 | ✅ ACTIEF | ? | Aggregated stats |
| `notifications` | 05 | ✅ ACTIEF | ? | In-app notifications |
| `priority_list_registrations` | schema.sql | ✅ ACTIEF | ? | Priority list |
| `admin_actions` | schema.sql | ✅ ACTIEF | ? | Admin audit |
| `email_verification_tokens` | schema.sql | ✅ ACTIEF | ? | Email verification |

---

### 🧹 CLEANUP CANDIDATES:

#### **HIGH PRIORITY** (200% zeker overbodig):
- ❌ **GEEN** - Alle tables lijken gebruikt te worden

#### **MEDIUM PRIORITY** (waarschijnlijk overbodig):
- ⚠️ `wallet_sync_logs` - Alleen debugging, mogelijk niet gebruikt
- ⚠️ `user_savings` (migration 04) - Mogelijk vervangen door `user_savings_stats`

#### **LOW PRIORITY** (check eerst):
- ⚠️ Duplicate table definitions - Moet gefixed worden maar niet verwijderen

---

### 📊 STALE DATA CLEANUP:

#### **Data die opgeruimd kan worden**:
1. **`ai_cache`**: Expired entries (>7 dagen oud)
2. **`wallet_sync_logs`**: Oude logs (>30 dagen)
3. **`gas_history`**: Oude data (>7 dagen) - **AUTO-CLEANUP al ingesteld**
4. **`notifications`**: Read + oud (>30 dagen)
5. **`email_verification_tokens`**: Expired tokens
6. **`scheduled_transactions`**: Expired/cancelled/failed (>7 dagen oud)

---

## 🚀 VERCEL AUDIT

### ✅ API ROUTES (36 routes):

#### **ACTIEF GEBRUIKT**:
- ✅ `/api/ai-assistant/*` - AI chat (2 routes)
- ✅ `/api/ai-portfolio-analysis` - Portfolio advisor
- ✅ `/api/cashback/*` - Cashback system (5 routes)
- ✅ `/api/cron/execute-scheduled-txs` - Cron job
- ✅ `/api/gas-optimizer` - Gas optimizer
- ✅ `/api/jupiter-tokens` - Jupiter token list
- ✅ `/api/lightning/*` - Lightning Network (4 routes)
- ✅ `/api/prices` - Main price API
- ✅ `/api/prices-binance` - Binance fallback (gebruikt in price-service)
- ✅ `/api/prices-by-address` - Address-based prices (gebruikt in price-service)
- ✅ `/api/priority-list/*` - Priority list (4 routes)
- ✅ `/api/referral/*` - Referral system (5 routes)
- ✅ `/api/smart-scheduler/*` - Smart scheduler (6 routes)
- ✅ `/api/smart-send/*` - Smart send (2 routes)
- ✅ `/api/swap/*` - Swap functionality (2 routes)
- ✅ `/api/transactions` - Transaction history

#### **⚠️ MOGELIJK OVERBODIG**:
- ❓ `/app/api/moonpay/` - **LEEG DIRECTORY** - Kan verwijderd worden

---

### 🔧 VERCEL CONFIGURATIE:

#### **vercel.json**:
- ✅ Build command: `npm run build`
- ✅ Output: `.next`
- ✅ Framework: Next.js
- ✅ Region: `iad1`
- ✅ Function timeouts: 30s (normal), 300s (cron)
- ✅ Cron jobs: 2 jobs (elke 5 minuten)

#### **Cron Jobs**:
1. ✅ `/api/cron/execute-scheduled-txs` - Elke 5 min
2. ✅ `/api/smart-scheduler/execute` - Elke 5 min

**Status**: Beide zijn ACTIEF en nodig

---

### 📦 VERCEL DEPLOYMENTS:

- **Totaal deployments**: 14+ (laatste 5 uur)
- **Status**: Meeste Ready, 1 Error
- **Aanbeveling**: Oude deployments kunnen gearchiveerd worden (Vercel doet dit automatisch)

---

## 🎯 AANBEVELINGEN

### **SUPABASE**:

#### **1. FIX DUPLICATE TABLES** (KRITIEK):
```sql
-- Check of scheduled_transactions schema conflicteert
-- Check of gas_alerts schema conflicteert
-- Merge migrations indien nodig
```

#### **2. VERWIJDER OVERBODIGE TABLES** (na verificatie):
- `wallet_sync_logs` - Als niet gebruikt
- `user_savings` (migration 04) - Als vervangen door `user_savings_stats`

#### **3. CLEANUP STALE DATA**:
- Run cleanup scripts voor expired data
- Setup automatische cleanup voor notifications

### **VERCEL**:

#### **1. VERWIJDER OVERBODIGE FILES**:
- ❌ `/app/api/moonpay/` directory (leeg)

#### **2. OPTIMIZE**:
- Archive oude deployments (automatisch)
- Check environment variables voor ongebruikte keys

---

## 📝 VOLGENDE STAPPEN:

1. ✅ **Run `supabase-audit.sql`** in Supabase SQL Editor
2. ✅ **Check row counts** voor elke table
3. ✅ **Verify duplicate tables** - Check schema conflicts
4. ✅ **Test API routes** - Verify alle routes werken
5. ✅ **Cleanup stale data** - Run cleanup queries
6. ✅ **Remove empty directories** - moonpay/

---

## ⚠️ WAARSCHUWINGEN:

- **NIET VERWIJDEREN** zonder eerst te checken:
  - Alle tables die in migrations staan
  - Alle API routes die in code gebruikt worden
  - Environment variables zonder eerst te verifiëren

- **WEL VERWIJDEREN** (200% zeker):
  - Lege directories (`/app/api/moonpay/`)
  - Stale data (na verificatie)
  - Duplicate table definitions (na merge)

---

**GENERATED**: $(date)
**AUDIT BY**: AI Assistant
**STATUS**: ✅ Complete - Ready for review
