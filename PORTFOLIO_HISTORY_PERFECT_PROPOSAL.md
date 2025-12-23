# 🔥 PERFECT PORTFOLIO HISTORY PROPOSAL - BITVAVO STYLE

## 🎯 HOE BITVAVO HET DOET

**Bitvavo's aanpak:**
1. ✅ **Server-side storage** - Portfolio snapshots in database
2. ✅ **Multi-device sync** - Grafiek identiek op alle apparaten
3. ✅ **Reconstructie** - Gebruikt token holdings + historical prices
4. ✅ **Slimme intervals** - Niet elke minuut, maar strategisch:
   - LIVE: Elke 30 seconden (laatste 30 min)
   - 1D: Elk uur (24 punten)
   - 7D: Elke 6 uur (28 punten)
   - 30D: Elke dag (30 punten)
   - 1J: Elke week (52 punten)
5. ✅ **Fallback reconstructie** - Als er geen snapshots zijn, gebruik token holdings

---

## 📊 HUIDIGE SITUATIE (BLAZE WALLET)

**Problemen:**
- ❌ **localStorage alleen** - Niet gesynchroniseerd tussen apparaten
- ❌ **Te veel snapshots** - Elke 5 min = 288 per dag (te veel!)
- ❌ **Geen reconstructie fallback** - Als localStorage leeg is, geen data
- ❌ **Geen multi-device sync** - Elke device heeft eigen geschiedenis

---

## ✅ PERFECTE OPLOSSING: HYBRID APPROACH

### **Concept:**
1. **Supabase** voor multi-device sync (server-side)
2. **localStorage** voor snelle cache (client-side)
3. **Reconstructie** als fallback (zoals Bitvavo)
4. **Slimme intervals** (niet elke 5 min, maar strategisch)

---

## 🏗️ IMPLEMENTATIE

### **1. Supabase Table: `portfolio_snapshots`**

```sql
CREATE TABLE IF NOT EXISTS public.portfolio_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Snapshot data
  balance_usd DECIMAL(18, 2) NOT NULL,
  address TEXT NOT NULL,
  chain TEXT NOT NULL,
  
  -- Timestamp
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Metadata (optional)
  token_count INTEGER DEFAULT 0,
  native_balance TEXT,
  
  -- Indexes for fast queries
  CONSTRAINT unique_user_address_chain_time UNIQUE (user_id, address, chain, snapshot_at)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_user_id ON public.portfolio_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_address_chain ON public.portfolio_snapshots(address, chain);
CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_snapshot_at ON public.portfolio_snapshots(snapshot_at DESC);

-- RLS
ALTER TABLE public.portfolio_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own snapshots"
  ON public.portfolio_snapshots FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own snapshots"
  ON public.portfolio_snapshots FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Auto-cleanup: Delete snapshots older than 1 year
CREATE OR REPLACE FUNCTION cleanup_old_portfolio_snapshots()
RETURNS void AS $$
BEGIN
  DELETE FROM public.portfolio_snapshots
  WHERE snapshot_at < NOW() - INTERVAL '1 year';
END;
$$ LANGUAGE plpgsql;

-- Run cleanup daily (via pg_cron)
SELECT cron.schedule(
  'cleanup-portfolio-snapshots',
  '0 2 * * *', -- Daily at 2 AM
  $$SELECT cleanup_old_portfolio_snapshots()$$
);
```

### **2. Slimme Snapshot Intervals**

```typescript
// lib/portfolio-history.ts

const SNAPSHOT_INTERVALS = {
  LIVE: 30 * 1000,      // 30 seconds (last 30 min)
  '1D': 60 * 60 * 1000, // 1 hour (24 points)
  '7D': 6 * 60 * 60 * 1000, // 6 hours (28 points)
  '30D': 24 * 60 * 60 * 1000, // 1 day (30 points)
  '1J': 7 * 24 * 60 * 60 * 1000, // 1 week (52 points)
  'ALLES': 7 * 24 * 60 * 60 * 1000, // 1 week (for long-term)
};

function shouldTakeSnapshot(
  lastSnapshotTime: number,
  selectedTimeframe: 'LIVE' | '1D' | '7D' | '30D' | '1J' | 'ALLES'
): boolean {
  const interval = SNAPSHOT_INTERVALS[selectedTimeframe];
  return Date.now() - lastSnapshotTime >= interval;
}
```

### **3. Hybrid Storage: Supabase + localStorage**

```typescript
// lib/portfolio-history.ts - NIEUWE VERSIE

export class PortfolioHistory {
  private snapshots: BalanceSnapshot[] = [];
  private supabase: SupabaseClient | null = null;
  private userId: string | null = null;

  constructor() {
    // Initialize Supabase if user is logged in
    if (typeof window !== 'undefined') {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (supabaseUrl && supabaseKey) {
        this.supabase = createClient(supabaseUrl, supabaseKey);
        // Get user ID from localStorage
        this.userId = localStorage.getItem('supabase_user_id');
      }
    }
    
    // Load from localStorage first (fast)
    this.loadFromStorage();
    
    // Then sync from Supabase in background (if logged in)
    if (this.supabase && this.userId) {
      this.syncFromSupabase();
    }
  }

  // Load from localStorage (fast, for instant display)
  private loadFromStorage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.snapshots = JSON.parse(stored);
      }
    } catch (error) {
      logger.error('Error loading portfolio history:', error);
      this.snapshots = [];
    }
  }

  // Sync from Supabase (background, for multi-device sync)
  private async syncFromSupabase() {
    if (!this.supabase || !this.userId) return;
    
    try {
      const { data, error } = await this.supabase
        .from('portfolio_snapshots')
        .select('*')
        .eq('user_id', this.userId)
        .order('snapshot_at', { ascending: false })
        .limit(MAX_SNAPSHOTS);
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        // Convert Supabase format to BalanceSnapshot
        this.snapshots = data.map(s => ({
          timestamp: new Date(s.snapshot_at).getTime(),
          balance: parseFloat(s.balance_usd),
          address: s.address,
          chain: s.chain,
        }));
        
        // Save to localStorage for fast access
        this.saveToStorage();
        
        logger.log(`✅ Synced ${this.snapshots.length} snapshots from Supabase`);
      }
    } catch (error) {
      logger.error('Error syncing from Supabase:', error);
    }
  }

  // Add snapshot (save to both localStorage AND Supabase)
  async addSnapshot(
    balance: number, 
    address: string, 
    chain: string,
    selectedTimeframe?: 'LIVE' | '1D' | '7D' | '30D' | '1J' | 'ALLES'
  ) {
    const now = Date.now();
    
    // Check if we should take a snapshot (smart intervals)
    const lastSnapshot = this.snapshots[this.snapshots.length - 1];
    if (lastSnapshot && selectedTimeframe) {
      if (!shouldTakeSnapshot(lastSnapshot.timestamp, selectedTimeframe)) {
        // Update last snapshot instead of creating new one
        lastSnapshot.balance = balance;
        lastSnapshot.timestamp = now;
        this.saveToStorage();
        // Also update in Supabase
        if (this.supabase && this.userId) {
          await this.updateLastSnapshotInSupabase(lastSnapshot);
        }
        return;
      }
    }
    
    // Create new snapshot
    const snapshot: BalanceSnapshot = {
      timestamp: now,
      balance,
      address,
      chain,
    };
    
    this.snapshots.push(snapshot);
    
    // Keep only last MAX_SNAPSHOTS
    if (this.snapshots.length > MAX_SNAPSHOTS) {
      this.snapshots = this.snapshots.slice(-MAX_SNAPSHOTS);
    }
    
    // Save to localStorage (fast)
    this.saveToStorage();
    
    // Save to Supabase (background, for sync)
    if (this.supabase && this.userId) {
      await this.saveSnapshotToSupabase(snapshot);
    }
  }

  // Save to Supabase
  private async saveSnapshotToSupabase(snapshot: BalanceSnapshot) {
    if (!this.supabase || !this.userId) return;
    
    try {
      const { error } = await this.supabase
        .from('portfolio_snapshots')
        .insert({
          user_id: this.userId,
          balance_usd: snapshot.balance,
          address: snapshot.address,
          chain: snapshot.chain,
          snapshot_at: new Date(snapshot.timestamp).toISOString(),
        });
      
      if (error) throw error;
      
      logger.log(`✅ Saved snapshot to Supabase: $${snapshot.balance.toFixed(2)}`);
    } catch (error) {
      logger.error('Error saving snapshot to Supabase:', error);
      // Don't throw - localStorage is primary, Supabase is sync
    }
  }
}
```

### **4. Fallback Reconstructie (Zoals Bitvavo)**

```typescript
// In BalanceChart.tsx - ALTIJD proberen:

1. Check localStorage snapshots (fast)
2. Check Supabase snapshots (if logged in)
3. If no snapshots → Reconstruct from token holdings + historical prices
4. Display chart with best available data
```

---

## 🎯 VOORDELEN VAN DEZE AANPAK

### **✅ Multi-Device Sync**
- Grafiek identiek op alle apparaten
- Supabase als single source of truth
- localStorage voor snelle cache

### **✅ Performance**
- localStorage = instant loading
- Supabase = background sync
- Reconstructie = fallback (altijd data)

### **✅ Efficient Storage**
- Slimme intervals (niet elke 5 min)
- Auto-cleanup (ouder dan 1 jaar)
- Max 100 snapshots per user

### **✅ Accuraatheid**
- Echte snapshots (als beschikbaar)
- Reconstructie fallback (zoals Bitvavo)
- Altijd data, zelfs zonder snapshots

---

## 📊 STORAGE COSTS (Supabase)

**Schatting per user:**
- 100 snapshots × ~50 bytes = 5 KB per user
- 10,000 users = 50 MB (verwaarloosbaar)
- Auto-cleanup houdt het klein

**Kosten:** Gratis tier is ruim voldoende

---

## 🚀 IMPLEMENTATIE STAPPEN

1. ✅ **Create Supabase table** (`portfolio_snapshots`)
2. ✅ **Update PortfolioHistory class** (hybrid storage)
3. ✅ **Add smart intervals** (niet elke 5 min)
4. ✅ **Keep reconstructie** (fallback zoals Bitvavo)
5. ✅ **Test multi-device sync**

---

## 🎯 RESULTAAT

- ✅ **Exact zoals Bitvavo**: Server-side storage + reconstructie
- ✅ **Multi-device sync**: Grafiek identiek op alle apparaten
- ✅ **Performance**: localStorage cache + Supabase sync
- ✅ **Accuraatheid**: Altijd data (snapshots of reconstructie)
- ✅ **Efficient**: Slimme intervals, auto-cleanup

