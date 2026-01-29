# 📊 BLAZE ADMIN - ANALYTICS FUNCTIES STATUS

## 🎯 DASHBOARD OVERVIEW (`/api/admin/analytics/overview`)

### METRICS (24h)
| Functie | Status | Data Bron | Probleem |
|---------|--------|-----------|----------|
| **Active Users (24h)** | ❌ | `transaction_events` | Tabel is LEEG |
| **Total Transactions (24h)** | ❌ | `transaction_events.status='success'` | Tabel is LEEG |
| **Total Volume USD (24h)** | ❌ | `transaction_events.value_usd` | Tabel is LEEG |
| **Failed Transaction Rate** | ❌ | `transaction_events.status='failed'` | Tabel is LEEG |

### USER COHORTS
| Functie | Status | Data Bron | Probleem |
|---------|--------|-----------|----------|
| **New Users** | ⚠️ | `user_cohorts.user_segment='new_users'` | Tabel bestaat, maar mogelijk leeg |
| **Active Users** | ⚠️ | `user_cohorts.user_segment='active'` | Tabel bestaat, maar mogelijk leeg |
| **Power Users** | ⚠️ | `user_cohorts.user_segment='power_user'` | Tabel bestaat, maar mogelijk leeg |
| **Dormant** | ⚠️ | `user_cohorts.user_segment='dormant'` | Tabel bestaat, maar mogelijk leeg |
| **Churned** | ⚠️ | `user_cohorts.user_segment='churned'` | Tabel bestaat, maar mogelijk leeg |
| **Total Users** | ⚠️ | `user_cohorts` count | Werkt als tabel gevuld is |

### ALERTS
| Functie | Status | Data Bron | Probleem |
|---------|--------|-----------|----------|
| **Critical Alerts** | ❌ | `analytics_alerts` | Tabel bestaat NIET in schema! |
| **Unread Count** | ❌ | `analytics_alerts.status='unread'` | Tabel bestaat NIET in schema! |

---

## 👥 USER MANAGEMENT (`/api/admin/users`)

| Functie | Status | Data Bron | Probleem |
|---------|--------|-----------|----------|
| **List All Users** | ⚠️ | `user_profiles` | Werkt, maar... |
| **User Email** | ❌ | `profile.email` | Column bestaat NIET! Zit in `auth.users` |
| **Display Name** | ⚠️ | `user_profiles.display_name` | Altijd NULL of "BLAZE User" |
| **Created At** | ✅ | `user_profiles.created_at` | WERKT |
| **Wallet Count** | ✅ | `wallets` count per user | WERKT |
| **Transaction Count** | ❌ | `transaction_events` count | Tabel is LEEG |
| **Last Activity** | ⚠️ | `user_events.created_at` | Werkt als events getrackt worden |
| **User Segment** | ⚠️ | `user_cohorts.segment` | Werkt als gevuld |

---

## 👤 USER DETAILS (`/api/admin/users/[userId]`)

### PROFILE
| Functie | Status | Data Bron | Probleem |
|---------|--------|-----------|----------|
| **User ID** | ✅ | `user_profiles.user_id` | WERKT |
| **Email** | ❌ | `profile.email` | Column bestaat NIET! |
| **Display Name** | ⚠️ | `user_profiles.display_name` | NULL of "BLAZE User" |
| **Created At** | ✅ | `user_profiles.created_at` | WERKT |

### WALLETS
| Functie | Status | Data Bron | Probleem |
|---------|--------|-----------|----------|
| **Wallet Addresses** | ✅ | `wallets.wallet_address` | WERKT |
| **Wallet Names** | ✅ | `wallets.wallet_name` | WERKT |

### BALANCES (when ?balances=true)
| Functie | Status | Data Bron | Probleem |
|---------|--------|-----------|----------|
| **Bitcoin Balance** | ⚠️ | Live blockchain API call | Slow, maar werkt IN THEORIE |
| **Ethereum Balance** | ⚠️ | Live blockchain API call | Slow, maar werkt IN THEORIE |
| **Solana Balance** | ⚠️ | Live blockchain API call | Slow, maar werkt IN THEORIE |
| **ERC-20 Tokens** | ⚠️ | Live blockchain API call | Slow, maar werkt IN THEORIE |
| **Token USD Values** | ⚠️ | PriceService + balances | Werkt als APIs niet rate-limiten |
| **Total Portfolio USD** | ⚠️ | Sum of all chains | Werkt als bovenstaande werken |

**NOTE:** Balances zijn NIET gecached! Elke request = nieuwe blockchain API calls = SLOW (10-30 sec!)

---

## 💸 TRANSACTION ANALYTICS (`/api/admin/analytics/transactions`)

| Functie | Status | Data Bron | Probleem |
|---------|--------|-----------|----------|
| **Send Initiated (24h)** | ❌ | `transaction_events.event_type='send_initiated'` | Tabel is LEEG |
| **Send Confirmed (24h)** | ❌ | `transaction_events.event_type='send_confirmed'` | Tabel is LEEG |
| **Send Failed (24h)** | ❌ | `transaction_events.event_type='send_failed'` | Tabel is LEEG |
| **Swap Initiated (24h)** | ❌ | `transaction_events.event_type='swap_initiated'` | Tabel is LEEG |
| **Swap Confirmed (24h)** | ❌ | `transaction_events.event_type='swap_confirmed'` | Tabel is LEEG |
| **Swap Failed (24h)** | ❌ | `transaction_events.event_type='swap_failed'` | Tabel is LEEG |
| **Receive Detected (24h)** | ❌ | `transaction_events.event_type='receive_detected'` | Tabel is LEEG |
| **Receive Detected (7d)** | ❌ | `transaction_events.event_type='receive_detected'` | Tabel is LEEG |

---

## 💳 ONRAMP ANALYTICS (`/api/admin/analytics/onramp`)

| Functie | Status | Data Bron | Probleem |
|---------|--------|-----------|----------|
| **Initiated (24h)** | ✅ | `user_events.event_name='onramp_purchase_initiated'` | WERKT! Data gevonden! |
| **Pending (24h)** | ✅ | `user_events.event_name='onramp_purchase_pending'` | WERKT (als events komen) |
| **Processing (24h)** | ✅ | `user_events.event_name='onramp_purchase_processing'` | WERKT (als events komen) |
| **Completed (24h)** | ✅ | `user_events.event_name='onramp_purchase_completed'` | WERKT (als events komen) |
| **Failed (24h)** | ✅ | `user_events.event_name='onramp_purchase_failed'` | WERKT (als events komen) |
| **Refunded (24h)** | ✅ | `user_events.event_name='onramp_purchase_refunded'` | WERKT (als events komen) |
| **Cancelled (24h)** | ✅ | `user_events.event_name='onramp_purchase_cancelled'` | WERKT (als events komen) |
| **Total Volume (24h)** | ✅ | `user_events.event_data.fiatAmount` | WERKT! |

**NOTE:** Deze endpoint WERKT omdat onramp events WEL getracked worden via `user_events`!

---

## 🔔 ALERTS (`/api/admin/analytics/alerts`)

| Functie | Status | Data Bron | Probleem |
|---------|--------|-----------|----------|
| **All Alerts** | ❌ | `analytics_alerts` | Tabel bestaat NIET! |
| **Filter by Severity** | ❌ | `analytics_alerts.severity` | Tabel bestaat NIET! |

---

## 👥 COHORTS (`/api/admin/analytics/cohorts`)

| Functie | Status | Data Bron | Probleem |
|---------|--------|-----------|----------|
| **User Segmentation** | ⚠️ | `user_cohorts` | Tabel bestaat, maar mogelijk leeg |
| **Cohort Details** | ⚠️ | `user_cohorts.*` | Werkt als data er is |

---

## 📊 SAMENVATTING

### ✅ WERKT GOED (5 functies):
1. User profiles ophalen (zonder email)
2. Wallet adressen tonen
3. Created at dates
4. Onramp analytics (via user_events)
5. Wallet count per user

### ⚠️ WERKT DEELS (6 functies):
1. Display names (altijd "BLAZE User")
2. Last activity (als user_events data heeft)
3. User cohorts (als tabel gevuld is)
4. Balances (SLOW, live blockchain calls)
5. Token prices (werkt maar slow)
6. Portfolio totals (werkt maar slow)

### ❌ WERKT NIET (12+ functies):
1. User emails (column bestaat niet)
2. Active users count (transaction_events leeg)
3. Total transactions (transaction_events leeg)
4. Transaction volume (transaction_events leeg)
5. Failed rate (transaction_events leeg)
6. ALL transaction analytics (send/swap/receive)
7. Alerts system (tabel bestaat niet)
8. Critical alerts (tabel bestaat niet)

---

## 🎯 ROOT CAUSES

### 1. TRANSACTION_EVENTS TABEL IS LEEG
**Impact:** Alle transaction analytics, active users, volume = broken

**Oplossing:** Wallet app moet transacties tracken naar deze tabel

### 2. ANALYTICS_ALERTS TABEL BESTAAT NIET
**Impact:** Alert systeem werkt helemaal niet

**Oplossing:** Tabel aanmaken of alert endpoints verwijderen

### 3. USER_PROFILES HEEFT GEEN EMAIL
**Impact:** Kan geen emails tonen in admin

**Oplossing:** Join met auth.users OF email kolom toevoegen

### 4. DISPLAY_NAME WORDT NIET GEZET
**Impact:** Altijd "BLAZE User" of NULL

**Oplossing:** Wallet app moet display_name updaten bij username change

### 5. BALANCES NIET GECACHED
**Impact:** Super slow (10-30 sec per user!)

**Oplossing:** Cache balances in database OF accepteer slow performance

---

## 🔧 FIX PRIORITEITEN

### QUICK WINS (kan ik NU fixen):
1. ✅ Email ophalen via auth.users join
2. ✅ Active users berekenen via user_events (ipv transaction_events)
3. ✅ Toon "No transactions tracked" messages
4. ✅ Remove broken alerts endpoints

### REQUIRES WALLET APP CHANGES:
1. 📝 Track transactions naar transaction_events
2. 📝 Save username naar user_profiles.display_name
3. 📝 Optioneel: Cache balances

### REQUIRES NEW FEATURES:
1. 📝 Build alerts system
2. 📝 Populate user_cohorts automatically
3. 📝 Add transaction volume tracking

