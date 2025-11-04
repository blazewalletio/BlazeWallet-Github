# 🗄️ SUPABASE MIGRATION GUIDE - GAS OPTIMIZER

## ✅ **VEREIST VOOR:**
- Historical gas data (24h/7d trends)
- Gas price statistics
- Future features: Gas alerts, scheduled transactions, savings tracker

## 📋 **WAT DEZE MIGRATION DOET:**

### **1. Creates Tables:**
- `gas_history` - Stores historical gas prices (7-day rolling window)
- `gas_alerts` - User gas price alerts (future feature)
- `scheduled_transactions` - Automated transaction scheduling (future feature)
- `user_savings` - Track how much users saved (future feature)

### **2. Security:**
- Row Level Security (RLS) enabled
- Users can only see/edit their own data
- Public read for gas_history (no sensitive data)

### **3. Indexes:**
- Optimized for fast queries
- Auto-cleanup of old data (> 7 days)

### **4. Helper Functions:**
- `get_gas_stats_24h(chain)` - Get 24h statistics
- `get_user_total_savings(user_id)` - Get user savings
- `check_gas_alerts(chain, gas)` - Check if alerts should trigger

---

## 🚀 **HOE TE RUNNEN:**

### **Optie A: Via Supabase Dashboard** (Aanbevolen)

1. **Open Supabase Dashboard:**
   ```
   https://supabase.com/dashboard/project/YOUR_PROJECT_ID
   ```

2. **Ga naar SQL Editor:**
   - Klik op "SQL Editor" in het linker menu
   - Of ga direct naar: `https://supabase.com/dashboard/project/YOUR_PROJECT_ID/sql`

3. **Nieuwe Query:**
   - Klik op "+ New query"
   - Geef het een naam: "Gas Optimizer Migration"

4. **Copy/Paste de Migration:**
   - Open: `supabase-migrations/04-gas-optimizer.sql`
   - Kopieer de **volledige inhoud**
   - Plak in de SQL Editor

5. **Run de Migration:**
   - Klik op "Run" (of druk Cmd+Enter / Ctrl+Enter)
   - **Wacht** tot het klaar is (~2-5 seconden)

6. **Verificatie:**
   - Kijk of je deze melding ziet: "Success. No rows returned"
   - Check onder "Table Editor" → Je zou nu 4 nieuwe tables moeten zien:
     - `gas_history`
     - `gas_alerts`
     - `scheduled_transactions`
     - `user_savings`

---

### **Optie B: Via Supabase CLI** (Advanced)

**Vereisten:**
- Supabase CLI geïnstalleerd: `npm install -g supabase`
- Project linked: `supabase link --project-ref YOUR_PROJECT_ID`

**Commands:**
```bash
cd "/Users/rickschlimback/Desktop/BlazeWallet 21-10"

# Push migration naar Supabase
supabase db push

# Of run specifieke migration
supabase db push --file supabase-migrations/04-gas-optimizer.sql
```

---

## 🧪 **VERIFICATIE:**

### **1. Check Tables Exist:**

Run deze query in SQL Editor:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('gas_history', 'gas_alerts', 'scheduled_transactions', 'user_savings');
```

**Verwacht:** 4 rows (alle 4 tables)

### **2. Check RLS Policies:**

```sql
SELECT tablename, policyname 
FROM pg_policies 
WHERE tablename IN ('gas_history', 'gas_alerts', 'scheduled_transactions', 'user_savings');
```

**Verwacht:** ~10-12 policies (security rules)

### **3. Check Helper Functions:**

```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN ('get_gas_stats_24h', 'get_user_total_savings', 'check_gas_alerts', 'cleanup_old_gas_history');
```

**Verwacht:** 4 functions

### **4. Test Gas History Insert:**

```sql
-- Test insert
INSERT INTO gas_history (chain, base_fee, priority_fee, gas_price, slow, standard, fast, instant, source)
VALUES ('ethereum', 25.5, 2.0, 27.5, 20.0, 27.5, 35.0, 50.0, 'test');

-- Check if it worked
SELECT * FROM gas_history WHERE source = 'test' ORDER BY created_at DESC LIMIT 1;

-- Clean up test data
DELETE FROM gas_history WHERE source = 'test';
```

**Verwacht:** INSERT succesvol, SELECT toont jouw row, DELETE verwijdert het

---

## ⚠️ **POTENTIËLE ISSUES & OPLOSSINGEN:**

### **Issue 1: "relation already exists"**
**Oorzaak:** Je hebt de migration al eerder gedraaid  
**Oplossing:** Skip dit - tables bestaan al!  
**Check:** Ga naar Table Editor en kijk of tables er zijn

### **Issue 2: "permission denied"**
**Oorzaak:** Insufficient permissions  
**Oplossing:**
1. Ga naar: Settings → Database
2. Check dat je de juiste role hebt (postgres/service_role)
3. Of gebruik Supabase Dashboard (heeft altijd permissions)

### **Issue 3: "syntax error"**
**Oorzaak:** Copy/paste ging mis  
**Oplossing:**
1. Kopieer de SQL opnieuw (hele bestand!)
2. Zorg dat er geen extra characters zijn toegevoegd
3. Run regel voor regel als het niet werkt

### **Issue 4: Migration succesvol, maar geen data**
**Oorzaak:** Normaal! Historical data groeit over tijd  
**Oplossing:**
- **Optie A:** Uncomment seed data in migration (regel ~450)
- **Optie B:** Wacht 24h en data accumuleert automatisch
- **Optie C:** Use fallback (app werkt ook zonder historical data)

---

## 📊 **WAT GEBEURT ER NA DE MIGRATION:**

### **Immediate (Direct na migration):**
- ✅ Tables created
- ✅ Security policies active
- ✅ Helper functions available
- ⏳ **NO DATA YET** (normaal!)

### **Within 24 Hours:**
- Historical data begint te accumuleren
- Elke keer dat een user Gas Optimizer opent, wordt gas price opgeslagen
- Na 24h: Je hebt 24h statistics
- Na 7d: Je hebt 7d statistics

### **In Production:**
- App werkt ZONDER historical data (gebruikt fallback)
- App werkt BETER MET historical data (accurate trends)
- **Optional:** Set up cron job to record gas prices every 5 minutes

---

## 🔄 **ROLLBACK (Als je migration wilt undoen):**

**⚠️ WARNING: Dit verwijdert ALLE data in deze tables!**

```sql
-- Drop all tables (cascade removes dependencies)
DROP TABLE IF EXISTS gas_history CASCADE;
DROP TABLE IF EXISTS gas_alerts CASCADE;
DROP TABLE IF EXISTS scheduled_transactions CASCADE;
DROP TABLE IF EXISTS user_savings CASCADE;

-- Drop helper functions
DROP FUNCTION IF EXISTS get_gas_stats_24h CASCADE;
DROP FUNCTION IF EXISTS get_user_total_savings CASCADE;
DROP FUNCTION IF EXISTS check_gas_alerts CASCADE;
DROP FUNCTION IF EXISTS cleanup_old_gas_history CASCADE;
```

---

## ✅ **CHECKLIST:**

- [ ] Supabase Dashboard geopend
- [ ] SQL Editor geopend
- [ ] `04-gas-optimizer.sql` inhoud gekopieerd
- [ ] Migration succesvol gerun
- [ ] Tables zichtbaar in Table Editor
- [ ] Verificatie queries gerun (alle passed)
- [ ] App getest (Gas Optimizer werkt)

---

## 💡 **TIPS:**

1. **Seed Data (Optional):**
   - Wil je direct data voor testing?
   - Uncomment regels ~450-490 in `04-gas-optimizer.sql`
   - Run migration opnieuw
   - Je hebt nu 24h historical data voor Ethereum

2. **Monitor Data Growth:**
   ```sql
   SELECT chain, COUNT(*) as records, MIN(created_at) as oldest, MAX(created_at) as newest
   FROM gas_history
   GROUP BY chain;
   ```

3. **Manual Cleanup (If needed):**
   ```sql
   -- Delete data older than 7 days
   DELETE FROM gas_history WHERE created_at < NOW() - INTERVAL '7 days';
   ```

4. **Check Storage:**
   ```sql
   SELECT pg_size_pretty(pg_total_relation_size('gas_history')) as size;
   ```
   **Expected:** < 1 MB (for 7 days of data)

---

## 🆘 **HULP NODIG?**

**Als de migration faalt:**
1. Screenshot de error message
2. Check Supabase logs: Dashboard → Logs → Database
3. Verify je bent in de juiste project
4. Try running query stap-voor-stap (one section at a time)

**Als het werkt maar geen data:**
- **Normaal!** Data groeit over tijd
- Check: `SELECT COUNT(*) FROM gas_history;`
- Should be 0 direct na migration
- Will grow as users use Gas Optimizer

---

**Status na migration:** 🟢 **DATABASE READY!**

**Gas Optimizer werkt nu met:**
- ✅ Real-time gas prices (Etherscan/RPC)
- ✅ OpenAI AI analysis
- ✅ Historical data (if available, fallback otherwise)
- ✅ Real native currency prices (ETH/MATIC/BNB/etc)
- ✅ Multi-chain support (18 chains)

**Klaar!** 🎉
