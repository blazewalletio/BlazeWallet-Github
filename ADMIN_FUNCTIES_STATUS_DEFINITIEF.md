# 📊 BLAZE ADMIN - ALLE FUNCTIES STATUS

## TAB 1: OVERVIEW (Dashboard Homepage)

### Metrics Cards
| # | Functie | Status | Reden |
|---|---------|--------|-------|
| 1 | **Active Users (24h)** | ❌ | `transaction_events` is LEEG |
| 2 | **Transactions (24h)** | ❌ | `transaction_events` is LEEG |
| 3 | **Volume (24h)** | ❌ | `transaction_events` is LEEG |
| 4 | **Failed Rate** | ❌ | `transaction_events` is LEEG |

### User Segments
| # | Functie | Status | Reden |
|---|---------|--------|-------|
| 5 | **New Users** | ❌ | `user_cohorts` tabel bestaat maar is LEEG |
| 6 | **Active Users** | ❌ | `user_cohorts` tabel bestaat maar is LEEG |
| 7 | **Power Users** | ❌ | `user_cohorts` tabel bestaat maar is LEEG |
| 8 | **Dormant** | ❌ | `user_cohorts` tabel bestaat maar is LEEG |
| 9 | **Churned** | ❌ | `user_cohorts` tabel bestaat maar is LEEG |

### Alerts
| # | Functie | Status | Reden |
|---|---------|--------|-------|
| 10 | **Critical Alerts** | ❌ | `analytics_alerts` tabel bestaat NIET |
| 11 | **Unread Alert Count** | ❌ | `analytics_alerts` tabel bestaat NIET |

---

## TAB 2: TRANSACTIONS

### Send Transactions
| # | Functie | Status | Reden |
|---|---------|--------|-------|
| 12 | **Send Initiated** | ❌ | `transaction_events` is LEEG |
| 13 | **Send Confirmed** | ❌ | `transaction_events` is LEEG |
| 14 | **Send Failed** | ❌ | `transaction_events` is LEEG |

### Swap Transactions
| # | Functie | Status | Reden |
|---|---------|--------|-------|
| 15 | **Swap Initiated** | ❌ | `transaction_events` is LEEG |
| 16 | **Swap Confirmed** | ❌ | `transaction_events` is LEEG |
| 17 | **Swap Failed** | ❌ | `transaction_events` is LEEG |

### Receive Events
| # | Functie | Status | Reden |
|---|---------|--------|-------|
| 18 | **Receive Detected (24h)** | ❌ | `transaction_events` is LEEG |
| 19 | **Receive Detected (7d)** | ❌ | `transaction_events` is LEEG |

---

## TAB 3: USERS

### User Stats
| # | Functie | Status | Reden |
|---|---------|--------|-------|
| 20 | **Total Users** | ⚠️ | Werkt maar toont count van LEGE `user_cohorts` = 0 |
| 21 | **Active Today** | ❌ | Gebruikt `transaction_events` (leeg) |
| 22 | **New This Month** | ❌ | Gebruikt `user_cohorts.new_users` (leeg) |

### Users Table
| # | Functie | Status | Reden |
|---|---------|--------|-------|
| 23 | **Email** | ❌ | Probeert `profile.email` maar die column bestaat NIET |
| 24 | **Display Name** | ⚠️ | Column bestaat maar is altijd NULL of "BLAZE User" |
| 25 | **Wallet Count** | ✅ | **WERKT** - telt wallets per user |
| 26 | **Transaction Count** | ❌ | Gebruikt `transaction_events` (leeg) |
| 27 | **Last Activity** | ⚠️ | Gebruikt `user_events` - werkt als er events zijn |
| 28 | **Segment** | ❌ | Gebruikt `user_cohorts` (leeg) |
| 29 | **Search Users** | ⚠️ | Werkt maar zoekt op kapotte email/display_name |

---

## TAB 4: ONRAMP

### Volume
| # | Functie | Status | Reden |
|---|---------|--------|-------|
| 30 | **Total Onramp Volume (24h)** | ✅ | **WERKT** - gebruikt `user_events` |

### Status Cards
| # | Functie | Status | Reden |
|---|---------|--------|-------|
| 31 | **Initiated** | ✅ | **WERKT** - `user_events.onramp_purchase_initiated` |
| 32 | **Pending** | ✅ | **WERKT** - `user_events.onramp_purchase_pending` |
| 33 | **Processing** | ✅ | **WERKT** - `user_events.onramp_purchase_processing` |
| 34 | **Completed** | ✅ | **WERKT** - `user_events.onramp_purchase_completed` |
| 35 | **Failed** | ✅ | **WERKT** - `user_events.onramp_purchase_failed` |
| 36 | **Refunded** | ✅ | **WERKT** - `user_events.onramp_purchase_refunded` |
| 37 | **Cancelled** | ✅ | **WERKT** - `user_events.onramp_purchase_cancelled` |

---

## USER DETAIL PAGE

### Profile Card
| # | Functie | Status | Reden |
|---|---------|--------|-------|
| 38 | **User Email** | ❌ | Probeert `profile.email` maar bestaat NIET |
| 39 | **Display Name** | ⚠️ | Bestaat maar is NULL of "BLAZE User" |
| 40 | **User ID** | ✅ | **WERKT** |
| 41 | **Join Date** | ✅ | **WERKT** - `user_profiles.created_at` |

### Stats Grid
| # | Functie | Status | Reden |
|---|---------|--------|-------|
| 42 | **Total Transactions** | ❌ | Gebruikt `transaction_events` (leeg) |
| 43 | **Success Rate** | ❌ | Berekent van `transaction_events` (leeg) |
| 44 | **Total Sends** | ❌ | Gebruikt `transaction_events` (leeg) |
| 45 | **Total Swaps** | ❌ | Gebruikt `transaction_events` (leeg) |

### Wallets Section
| # | Functie | Status | Reden |
|---|---------|--------|-------|
| 46 | **Wallet Addresses** | ✅ | **WERKT** |
| 47 | **Wallet Count** | ✅ | **WERKT** |

### Balances Section (View Balances button)
| # | Functie | Status | Reden |
|---|---------|--------|-------|
| 48 | **Total Portfolio USD** | ❌ | Live blockchain calls → meestal $0 of timeout |
| 49 | **Per Chain Balances** | ❌ | Live blockchain calls → meestal $0 of timeout |
| 50 | **Tokens (ERC-20/SPL)** | ❌ | Live blockchain calls → meestal $0 of timeout |

**WAAROM BALANCES NIET WERKT:**
- Admin roept blockchain APIs LIVE aan (Alchemy, Solana RPC)
- Dit duurt 10-30 seconden PER user
- Rate limits → vaak $0 resultaten
- Geen caching → elke keer opnieuw fetchen
- API keys in admin mogelijk niet goed geconfigureerd

### Recent Transactions
| # | Functie | Status | Reden |
|---|---------|--------|-------|
| 51 | **Transaction List** | ❌ | Gebruikt `transaction_events` (leeg) |

---

## 📊 EINDTOTAAL

### ✅ **WERKT GOED** (10 functies):
1. User ID
2. Join Date  
3. Wallet Addresses
4. Wallet Count (in user detail)
5. Wallet Count (in user table)
6. Onramp Volume
7. Onramp Initiated
8. Onramp Pending
9. Onramp Processing
10. Onramp Completed
11. Onramp Failed
12. Onramp Refunded
13. Onramp Cancelled

### ⚠️ **WERKT DEELS** (4 functies):
1. Display Name (bestaat maar is leeg)
2. Last Activity (werkt als events bestaan)
3. Search Users (werkt maar zoekt op kapotte data)
4. Total Users count (toont 0 want cohorts leeg)

### ❌ **WERKT NIET** (37 functies):
1. Active Users (24h)
2. Transactions (24h)
3. Volume (24h)
4. Failed Rate
5. New Users cohort
6. Active Users cohort
7. Power Users cohort
8. Dormant cohort
9. Churned cohort
10. Critical Alerts
11. Unread Alerts
12. Send Initiated
13. Send Confirmed
14. Send Failed
15. Swap Initiated
16. Swap Confirmed
17. Swap Failed
18. Receive Detected (24h)
19. Receive Detected (7d)
20. Active Today
21. New This Month
22. User Email (in table)
23. Transaction Count (in table)
24. User Segment (in table)
25. User Email (detail page)
26. Total Transactions (detail page)
27. Success Rate
28. Total Sends
29. Total Swaps
30. Total Portfolio USD
31. Bitcoin Balance
32. Ethereum Balance
33. Solana Balance
34. All other chain balances
35. ERC-20/SPL Tokens
36. Recent Transactions List
37. Transaction details (event type, status, amount, hash)

---

## 🎯 ROOT CAUSES (3 hoofdproblemen)

### 1️⃣ **TRANSACTION_EVENTS TABEL IS LEEG**
**Impact:** 29 functies werken NIET
- Wallet app tracked GEEN transacties naar database
- Alle transaction analytics zijn broken
- Active users can't be calculated
- User stats zijn allemaal 0

### 2️⃣ **USER_PROFILES MIST EMAIL & DISPLAY_NAME**
**Impact:** 3 functies werken NIET
- Email zit in `auth.users` (aparte tabel), niet in `user_profiles`
- Display_name wordt niet gezet door wallet app
- Admin kan geen emails/usernames tonen

### 3️⃣ **BALANCES ZIJN NIET GECACHED**
**Impact:** 3 functies werken NIET (of super slow)
- Admin doet live blockchain API calls
- Rate limits → vaak $0 of timeout
- Duurt 10-30 sec per user
- Geen database caching

### 4️⃣ **USER_COHORTS & ANALYTICS_ALERTS BESTAAN NIET**
**Impact:** 12 functies werken NIET
- `user_cohorts` tabel is leeg (geen automatische segmentatie)
- `analytics_alerts` tabel bestaat helemaal niet
- Complete segmentatie & alert systeem is broken

---

## 🔧 WAT IK NU KAN FIXEN (Quick Wins)

1. ✅ Email ophalen via `auth.users` join (ipv `profile.email`)
2. ✅ Active users berekenen via `user_events` (ipv transaction_events)
3. ✅ Toon "Not tracked" placeholder voor transactions
4. ✅ Remove broken alerts UI (want tabel bestaat niet)
5. ✅ Toon "Not calculated" voor cohorts
6. ✅ Verberg broken balance knop of toon warning

**Deze 6 quick wins maken admin tenminste EERLIJK → toont wat WERKT en wat NIET WERKT**

---

## 🏗️ WAT WALLET APP MOET FIXEN (Grote werk)

1. 📝 Transaction tracking implementeren → `transaction_events` vullen
2. 📝 Username save implementeren → `display_name` updaten
3. 📝 Balance caching implementeren (optioneel maar wel handig)
4. 📝 User cohort automatisch berekenen (triggers/functions)

**Dit is de ECHTE oplossing, maar vereist wallet app changes**

