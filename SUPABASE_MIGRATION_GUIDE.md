# 🗄️ SUPABASE MIGRATION - AI ASSISTANT

## ✅ **ENVIRONMENT VARIABLES - COMPLEET**

- ✅ Vercel Production: `OPENAI_API_KEY` toegevoegd
- ✅ Vercel Preview: `OPENAI_API_KEY` toegevoegd  
- ✅ Vercel Development: `OPENAI_API_KEY` toegevoegd
- ✅ Local `.env.local`: `OPENAI_API_KEY` toegevoegd

---

## 📝 **SUPABASE MIGRATION UITVOEREN**

### **Optie 1: Via Supabase Dashboard (Aanbevolen)**

1. **Open Supabase Dashboard:**
   - Ga naar: https://supabase.com/dashboard
   - Selecteer je project: `BlazeWallet`

2. **Open SQL Editor:**
   - Klik op "SQL Editor" in het linker menu
   - Klik op "New Query"

3. **Copy Migration SQL:**
   - Open het bestand: `supabase-migrations/03-ai-assistant-cache.sql`
   - Kopieer de volledige inhoud (3991 characters)
   - Plak in de SQL Editor

4. **Run Migration:**
   - Klik op "Run" (of druk op Ctrl/Cmd + Enter)
   - Wacht op "Success" bericht

5. **Verify:**
   - Ga naar "Table Editor"
   - Check of de volgende tabellen bestaan:
     - ✓ `ai_cache`
     - ✓ `ai_rate_limits`

---

### **Optie 2: Via psql (Terminal)**

Als je psql geïnstalleerd hebt:

```bash
# Get connection string from Supabase Dashboard > Settings > Database
psql "YOUR_SUPABASE_CONNECTION_STRING" -f supabase-migrations/03-ai-assistant-cache.sql
```

---

### **Optie 3: Via Supabase CLI**

Als je Supabase CLI hebt:

```bash
supabase db push
```

---

## 🎯 **WAT WORDT AANGEMAAKT:**

### **1. `ai_cache` Table**
- Slaat AI responses op voor snelle hergebruik
- Automatische expiry na 24 uur
- Hit count tracking
- RLS policies voor security

**Columns:**
- `id` (UUID, primary key)
- `query_hash` (TEXT, unique) - Voor duplicate detection
- `query` (TEXT) - Originele query
- `response` (JSONB) - AI response
- `user_id` (TEXT) - Voor personalisatie
- `chain` (TEXT) - Welke blockchain
- `hit_count` (INTEGER) - Aantal keer gebruikt
- `created_at`, `expires_at`, `last_accessed_at` (TIMESTAMP)

### **2. `ai_rate_limits` Table**
- Tracks 50 queries/day per user
- Automatische reset per dag
- RLS policies

**Columns:**
- `id` (UUID, primary key)
- `user_id` (TEXT) - User identifier
- `date` (DATE) - Dag van gebruik
- `query_count` (INTEGER) - Aantal queries vandaag
- `created_at`, `updated_at` (TIMESTAMP)

### **3. Functions**
- `check_and_increment_rate_limit(user_id, max_queries)` - Rate limit check
- `cleanup_expired_ai_cache()` - Auto-cleanup (run daily via cron)

### **4. Indexes**
- `idx_ai_cache_query_hash` - Snelle cache lookup
- `idx_ai_cache_expires_at` - Cleanup efficiency
- `idx_ai_cache_user_id` - User queries
- `idx_ai_cache_chain` - Chain filtering
- `idx_ai_rate_limits_user_date` - Rate limit checks

---

## ✅ **VERIFICATION**

Na het uitvoeren van de migration, run:

```bash
node execute-ai-migration.js
```

Je zou moeten zien:
```
✅ Migration already applied! Tables exist.
📊 ai_cache table: ✓
📊 ai_rate_limits table: ✓
```

---

## 🔧 **ROLLBACK (indien nodig)**

Als je de migration wilt terugdraaien:

```sql
DROP TABLE IF EXISTS ai_cache CASCADE;
DROP TABLE IF EXISTS ai_rate_limits CASCADE;
DROP FUNCTION IF EXISTS check_and_increment_rate_limit CASCADE;
DROP FUNCTION IF EXISTS cleanup_expired_ai_cache CASCADE;
```

---

## 🚀 **VOLGENDE STAPPEN NA MIGRATION:**

1. ✅ Vercel redeploy triggeren (gebeurt automatisch bij push)
2. ✅ Test AI Assistant in de wallet
3. ✅ Check cache hit rates in Supabase dashboard
4. ✅ Monitor rate limiting

---

## 📊 **MONITORING**

### **Cache Statistics:**
```sql
SELECT 
  COUNT(*) as total_entries,
  SUM(hit_count) as total_hits,
  AVG(hit_count) as avg_hits_per_entry,
  COUNT(*) * 0.5 as estimated_kb
FROM ai_cache;
```

### **Rate Limit Stats:**
```sql
SELECT 
  COUNT(DISTINCT user_id) as unique_users,
  SUM(query_count) as total_queries_today,
  AVG(query_count) as avg_queries_per_user
FROM ai_rate_limits
WHERE date = CURRENT_DATE;
```

### **Most Popular Queries:**
```sql
SELECT 
  query,
  hit_count,
  chain,
  created_at
FROM ai_cache
ORDER BY hit_count DESC
LIMIT 10;
```

