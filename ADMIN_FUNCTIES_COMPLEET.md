# 📊 BLAZE ADMIN - ALLE FUNCTIES DIE ZOUDEN MOETEN WERKEN

## TAB 1: OVERVIEW (Dashboard Homepage)

### Metrics Cards (4 grote cards bovenaan)
1. **Active Users (24h)** - Hoeveel users actief waren laatste 24u
2. **Transactions (24h)** - Totaal aantal transacties laatste 24u  
3. **Volume (24h)** - Totaal USD volume laatste 24u
4. **Failed Rate** - Percentage gefaalde transacties

### User Segments (5 cohort cards)
5. **New Users** - Aantal nieuwe users
6. **Active Users** - Aantal actieve users
7. **Power Users** - Aantal power users  
8. **Dormant** - Aantal slapende users
9. **Churned** - Aantal weggevallen users

### Alerts (rood blok bovenaan)
10. **Critical Alerts** - Lijst van kritieke alerts
11. **Unread Alert Count** - Badge met aantal ongelezen alerts

---

## TAB 2: TRANSACTIONS

### Send Transactions Card
12. **Send Initiated** - Aantal gestarte send TXs (24h)
13. **Send Confirmed** - Aantal bevestigde send TXs (24h)
14. **Send Failed** - Aantal gefaalde send TXs (24h)

### Swap Transactions Card
15. **Swap Initiated** - Aantal gestarte swap TXs (24h)
16. **Swap Confirmed** - Aantal bevestigde swap TXs (24h)
17. **Swap Failed** - Aantal gefaalde swap TXs (24h)

### Receive Events Card
18. **Receive Detected (24h)** - Inkomende TXs gedetecteerd laatste 24u
19. **Receive Detected (7d)** - Inkomende TXs gedetecteerd laatste 7d

---

## TAB 3: USERS

### User Stats (3 cards bovenaan)
20. **Total Users** - Totaal aantal users
21. **Active Today** - Users actief vandaag
22. **New This Month** - Nieuwe users deze maand

### Users Table (tabel met alle users)
Voor elke user in de lijst:
23. **Email** - Email adres van user
24. **Display Name** - Username/display name
25. **Wallet Count** - Aantal wallets per user
26. **Transaction Count** - Aantal transacties per user
27. **Last Activity** - Laatste activiteit datum
28. **Segment** - User segment (new/active/power/dormant/churned)

### Search Functie
29. **Search Users** - Zoeken op email of naam

---

## TAB 4: ONRAMP

### Volume Card (grote groene card)
30. **Total Onramp Volume (24h)** - Totaal onramp volume in USD

### Onramp Status Cards (7 kleine cards)
31. **Initiated** - Aantal gestarte onramp purchases
32. **Pending** - Aantal pending purchases
33. **Processing** - Aantal processing purchases
34. **Completed** - Aantal completed purchases
35. **Failed** - Aantal gefaalde purchases
36. **Refunded** - Aantal refunded purchases
37. **Cancelled** - Aantal cancelled purchases

---

## USER DETAIL PAGE (klik op user → `/users/[userId]`)

### Profile Card (header)
38. **User Email**
39. **Display Name**
40. **User ID**
41. **Join Date**

### Stats Grid (4 cards)
42. **Total Transactions** - Totaal aantal transacties van deze user
43. **Success Rate** - Success rate percentage
44. **Total Sends** - Aantal send TXs van deze user
45. **Total Swaps** - Aantal swap TXs van deze user

### Wallets Section
46. **Wallet Addresses** - Lijst van alle wallet adressen van deze user
47. **Wallet Count** - Aantal wallets

### Balances Section (na klikken "View Balances" knop)
48. **Total Portfolio USD** - Totale portfolio waarde
49. **Per Chain Balance**:
    - Bitcoin balance + USD value
    - Ethereum balance + USD value  
    - Solana balance + USD value
    - Polygon balance + USD value
    - Arbitrum balance + USD value
    - Optimism balance + USD value
    - Base balance + USD value
    - BNB Chain balance + USD value
50. **ERC-20/SPL Tokens** - Alle tokens per chain met balance + USD value

### Recent Transactions Section
51. **Transaction List** - Laatste 20 transacties van deze user met:
    - Event type (send/swap/receive)
    - Status (success/pending/failed)
    - Amount + symbol
    - Timestamp
    - TX hash

---

## 📊 TOTAAL OVERZICHT

**TOTAAL: 51+ FUNCTIES/DATA POINTS**

### Categorieën:
- **Overview metrics**: 11 data points
- **Transaction analytics**: 8 data points  
- **User management**: 9 data points
- **Onramp analytics**: 8 data points
- **User details**: 15+ data points

---

## ✅/❌ STATUS CHECK

Ik ga nu per functie checken of deze WERKT of NIET WERKT...

