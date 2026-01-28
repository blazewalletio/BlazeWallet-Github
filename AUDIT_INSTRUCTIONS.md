# 📊 Live Supabase Database Audit

## Wat te doen:

### Stap 1: Open Supabase SQL Editor
1. Ga naar https://supabase.com
2. Open je Blaze Wallet project
3. Klik op **SQL Editor** in de linker sidebar
4. Klik op **New Query**

### Stap 2: Run de Audit Query
1. Open het bestand: `SUPABASE_LIVE_AUDIT.sql`
2. Copy de hele inhoud
3. Paste in Supabase SQL Editor
4. Klik **Run** (of druk Cmd+Enter)

### Stap 3: Kopieer de Results
Je krijgt meerdere resultaat tabellen:

**PART 1: USER_ID DATA FORMATS**
- Toont voor elke tabel: aantal UUIDs vs emails
- Sample user_ids

**PART 2: CURRENT RLS POLICIES**
- Alle huidige policies met hun USING/WITH CHECK expressies
- Dit is het belangrijkste deel!

**PART 3: USER_ID COLUMN TYPES**
- Data types van user_id kolommen (UUID vs TEXT)

**PART 4: RICK'S DATA CHECK**
- Specifiek jouw account data
- Contacten, wallet, devices

**PART 5: RLS ENABLED STATUS**
- Of RLS aan staat per tabel

### Stap 4: Share Results
Kopieer de output van **PART 2 (RLS POLICIES)** en **PART 1 (DATA FORMATS)** en plak hier.

Dan kan ik:
- ✅ Zien wat de HUIDIGE policies zijn
- ✅ Zien of user_ids UUIDs of emails zijn
- ✅ Een perfecte migratie maken op basis van je LIVE data
- ✅ Geen aannames, alleen facts!

## Waarom dit belangrijk is:
- Migratie bestanden kunnen niet uitgevoerd zijn
- Policies kunnen handmatig gewijzigd zijn
- Data kan gemixed format zijn (sommige UUID, sommige email)
- We moeten de EXACTE staat kennen voor een veilige fix

## Alternative: Screenshot
Als copy-pasten lastig is, maak screenshots van de resultaat tabellen en share die.
