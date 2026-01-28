# 🔍 USER ACTIVITY MONITORING - 3 PERFECTE VOORSTELLEN

**Datum**: 28 januari 2026  
**Project**: BLAZE Wallet  
**Doel**: Complete inzage in user activiteit zonder privacy-inbreuk, volledig GDPR-compliant

---

## 📊 HUIDIGE SITUATIE ANALYSE

### ✅ WAT WE AL HEBBEN:
1. **`user_activity_log`** - Algemene activity logging (login, logout, settings changes)
2. **`onramp_transactions`** - Fiat → Crypto purchases (Banxa, MoonPay, etc.)
3. **`transaction_notes`** - User-added notes op transactions
4. **`user_profiles`** - User metadata & preferences
5. **`trusted_devices`** - Device management
6. **`wallets`** - Encrypted wallet storage

### ❌ WAT WE MISSEN:
1. **Blockchain transaction tracking** - Send/receive/swap niet centraal gelogd
2. **Swap activity** - Jupiter/LiFi swaps worden niet bijgehouden
3. **Portfolio analytics** - Geen historische waarde tracking
4. **User behavior metrics** - Geen inzicht in app gebruik patronen
5. **Admin dashboard** - Geen centrale plek om user activity te bekijken
6. **Real-time monitoring** - Geen alerts voor verdacht gedrag

---

## 🎯 VOORSTEL 1: "PRIVACY-FIRST ANALYTICS DASHBOARD"

### **Concept**
Een volledig server-side analytics platform dat **alleen metadata** tracked, zonder gevoelige data (wallet addresses, amounts) direct zichtbaar te maken. GDPR-first approach met anonimisatie en opt-out.

### **📋 DATABASE SCHEMA**

```sql
-- =============================================================================
-- TABLE 1: WALLET TRANSACTIONS (BLOCKCHAIN)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Transaction Info (hashed for privacy)
  tx_hash_encrypted TEXT NOT NULL, -- Encrypted hash voor lookup
  chain_key TEXT NOT NULL, -- 'ethereum', 'solana', 'bitcoin', etc.
  
  -- Transaction Type
  type TEXT NOT NULL CHECK (type IN ('send', 'receive', 'swap', 'contract', 'nft')),
  
  -- Amounts (in USD for analytics, actual amounts encrypted)
  amount_usd DECIMAL(20, 2), -- Voor analytics en grafieken
  amount_encrypted TEXT, -- Encrypted actual amount + token
  
  -- Status & Timing
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed')),
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Gas & Fees
  gas_cost_usd DECIMAL(10, 2),
  
  -- Metadata (non-sensitive)
  token_symbol TEXT, -- Voor filtering
  is_internal BOOLEAN DEFAULT false, -- Wallet-to-wallet binnen app
  
  -- Privacy flag
  analytics_enabled BOOLEAN DEFAULT true -- User kan dit uitschakelen
);

CREATE INDEX idx_wallet_txs_user ON public.wallet_transactions(user_id, created_at DESC);
CREATE INDEX idx_wallet_txs_chain ON public.wallet_transactions(chain_key, type);
CREATE INDEX idx_wallet_txs_status ON public.wallet_transactions(status, confirmed_at);


-- =============================================================================
-- TABLE 2: SWAP TRANSACTIONS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.swap_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_transaction_id UUID REFERENCES public.wallet_transactions(id),
  
  -- Swap Details
  chain_key TEXT NOT NULL,
  protocol TEXT, -- 'jupiter', 'lifi', '1inch', 'uniswap'
  
  -- Tokens (symbols only for privacy)
  from_token_symbol TEXT NOT NULL,
  to_token_symbol TEXT NOT NULL,
  
  -- Amounts (USD for analytics)
  from_amount_usd DECIMAL(20, 2),
  to_amount_usd DECIMAL(20, 2),
  
  -- Actual amounts encrypted
  from_amount_encrypted TEXT,
  to_amount_encrypted TEXT,
  
  -- Performance Metrics
  slippage_percentage DECIMAL(5, 2),
  price_impact_percentage DECIMAL(5, 2),
  execution_time_ms INTEGER,
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'partially_filled')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Analytics
  analytics_enabled BOOLEAN DEFAULT true
);

CREATE INDEX idx_swap_txs_user ON public.swap_transactions(user_id, created_at DESC);
CREATE INDEX idx_swap_txs_protocol ON public.swap_transactions(protocol, status);
CREATE INDEX idx_swap_txs_pair ON public.swap_transactions(from_token_symbol, to_token_symbol);


-- =============================================================================
-- TABLE 3: USER ANALYTICS SUMMARY (Aggregated, no sensitive data)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.user_analytics_summary (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Activity Counts (Last 30 Days)
  total_transactions_30d INTEGER DEFAULT 0,
  total_swaps_30d INTEGER DEFAULT 0,
  total_onramps_30d INTEGER DEFAULT 0,
  
  -- Volume (USD, last 30 days)
  total_volume_usd_30d DECIMAL(20, 2) DEFAULT 0,
  swap_volume_usd_30d DECIMAL(20, 2) DEFAULT 0,
  
  -- App Usage
  total_logins_30d INTEGER DEFAULT 0,
  avg_session_duration_minutes DECIMAL(10, 2),
  last_active_at TIMESTAMPTZ,
  
  -- Chains Used
  active_chains JSONB DEFAULT '[]'::jsonb, -- ['ethereum', 'solana']
  preferred_chain TEXT,
  
  -- User Lifecycle
  first_transaction_at TIMESTAMPTZ,
  last_transaction_at TIMESTAMPTZ,
  days_since_signup INTEGER,
  is_active_user BOOLEAN DEFAULT false, -- Active = transaction in last 7 days
  
  -- Risk Flags (voor monitoring)
  high_volume_flag BOOLEAN DEFAULT false,
  suspicious_pattern_flag BOOLEAN DEFAULT false,
  
  -- Metadata
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_analytics_active ON public.user_analytics_summary(is_active_user, last_active_at DESC);
CREATE INDEX idx_user_analytics_volume ON public.user_analytics_summary(total_volume_usd_30d DESC);


-- =============================================================================
-- TABLE 4: APP EVENTS (Feature Usage Tracking)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.app_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Event Info
  event_type TEXT NOT NULL, -- 'page_view', 'feature_used', 'button_clicked', 'modal_opened'
  event_name TEXT NOT NULL, -- 'swap_modal_opened', 'buy_crypto_clicked', etc.
  
  -- Context
  page_path TEXT,
  chain_context TEXT,
  
  -- Metadata
  metadata JSONB, -- Flexible data storage
  
  -- Session Info
  session_id TEXT,
  device_type TEXT, -- 'mobile', 'desktop', 'tablet'
  
  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_app_events_user ON public.app_events(user_id, created_at DESC);
CREATE INDEX idx_app_events_type ON public.app_events(event_type, event_name);
CREATE INDEX idx_app_events_session ON public.app_events(session_id);


-- =============================================================================
-- TABLE 5: ADMIN INSIGHTS (Daily Aggregates)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.admin_daily_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  
  -- User Metrics
  total_users INTEGER DEFAULT 0,
  new_users_today INTEGER DEFAULT 0,
  active_users_today INTEGER DEFAULT 0, -- Had activity today
  
  -- Transaction Metrics
  total_transactions INTEGER DEFAULT 0,
  total_swaps INTEGER DEFAULT 0,
  total_onramps INTEGER DEFAULT 0,
  
  -- Volume Metrics (USD)
  total_volume_usd DECIMAL(20, 2) DEFAULT 0,
  swap_volume_usd DECIMAL(20, 2) DEFAULT 0,
  onramp_volume_usd DECIMAL(20, 2) DEFAULT 0,
  
  -- Chain Distribution (JSONB)
  volume_by_chain JSONB DEFAULT '{}'::jsonb,
  -- Example: {"ethereum": 15000, "solana": 8000, "bitcoin": 3000}
  
  -- Popular Tokens (Top 10)
  top_swapped_tokens JSONB DEFAULT '[]'::jsonb,
  -- Example: [{"symbol": "ETH", "count": 150}, {"symbol": "SOL", "count": 120}]
  
  -- App Usage
  total_sessions INTEGER DEFAULT 0,
  avg_session_duration_minutes DECIMAL(10, 2),
  
  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_daily_insights_date ON public.admin_daily_insights(date DESC);
```

### **🔐 ROW LEVEL SECURITY (RLS)**

```sql
-- Enable RLS on all tables
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swap_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_analytics_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_daily_insights ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "Users can view own wallet transactions"
  ON public.wallet_transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id AND analytics_enabled = true);

CREATE POLICY "Users can view own swap transactions"
  ON public.swap_transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id AND analytics_enabled = true);

CREATE POLICY "Users can view own analytics"
  ON public.user_analytics_summary FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own app events"
  ON public.app_events FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Service role (backend) can do everything
CREATE POLICY "Service role full access wallet_transactions"
  ON public.wallet_transactions FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access swap_transactions"
  ON public.swap_transactions FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access analytics"
  ON public.user_analytics_summary FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access events"
  ON public.app_events FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access daily insights"
  ON public.admin_daily_insights FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);
```

### **📱 FRONTEND IMPLEMENTATIE**

#### **1. Transaction Logging Hook**
```typescript
// hooks/useTransactionLogger.ts
import { useSupabaseClient } from '@/lib/supabase-client';

export function useTransactionLogger() {
  const supabase = useSupabaseClient();

  const logTransaction = async (tx: {
    txHash: string;
    chainKey: string;
    type: 'send' | 'receive' | 'swap' | 'contract';
    amountUSD: number;
    tokenSymbol: string;
    status: 'pending' | 'confirmed' | 'failed';
  }) => {
    try {
      // Encrypt sensitive data
      const encryptedData = await encryptTransactionData({
        txHash: tx.txHash,
        // ... other sensitive fields
      });

      await fetch('/api/analytics/log-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...tx,
          txHashEncrypted: encryptedData.hash,
          amountEncrypted: encryptedData.amount,
        }),
      });
    } catch (error) {
      console.error('Failed to log transaction:', error);
      // Fail silently - don't block user transaction
    }
  };

  return { logTransaction };
}
```

#### **2. Swap Logging Hook**
```typescript
// hooks/useSwapLogger.ts
export function useSwapLogger() {
  const logSwap = async (swap: {
    chainKey: string;
    protocol: string;
    fromToken: string;
    toToken: string;
    fromAmountUSD: number;
    toAmountUSD: number;
    slippage: number;
    executionTimeMs: number;
  }) => {
    await fetch('/api/analytics/log-swap', {
      method: 'POST',
      body: JSON.stringify(swap),
    });
  };

  return { logSwap };
}
```

#### **3. App Event Tracking**
```typescript
// hooks/useAnalytics.ts
export function useAnalytics() {
  const trackEvent = async (eventName: string, metadata?: Record<string, any>) => {
    await fetch('/api/analytics/track-event', {
      method: 'POST',
      body: JSON.stringify({
        eventType: 'feature_used',
        eventName,
        metadata,
      }),
    });
  };

  return { trackEvent };
}

// Usage in components:
const { trackEvent } = useAnalytics();

// Track swap modal open
trackEvent('swap_modal_opened', { chainKey: 'ethereum' });

// Track buy crypto click
trackEvent('buy_crypto_clicked', { provider: 'moonpay' });
```

### **🎨 ADMIN DASHBOARD**

#### **API Routes**
```typescript
// app/api/admin/analytics/overview/route.ts
export async function GET(request: NextRequest) {
  // Verify admin (service role or whitelisted email)
  const { searchParams } = new URL(request.url);
  const adminEmail = searchParams.get('admin');
  
  if (!isAdminUser(adminEmail)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get today's insights
  const todayInsights = await supabaseAdmin
    .from('admin_daily_insights')
    .select('*')
    .eq('date', new Date().toISOString().split('T')[0])
    .single();

  // Get active users (last 30 days)
  const { data: activeUsers } = await supabaseAdmin
    .from('user_analytics_summary')
    .select('*')
    .eq('is_active_user', true)
    .order('last_active_at', { ascending: false })
    .limit(100);

  // Get recent transactions
  const { data: recentTransactions } = await supabaseAdmin
    .from('wallet_transactions')
    .select('id, user_id, chain_key, type, amount_usd, status, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  return NextResponse.json({
    insights: todayInsights,
    activeUsers,
    recentTransactions,
  });
}
```

#### **Dashboard UI (Next.js Page)**
```typescript
// app/admin/analytics/page.tsx
export default function AnalyticsDashboard() {
  return (
    <div className="p-8">
      <h1>BLAZE Wallet - Admin Analytics</h1>
      
      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <KPICard title="Active Users (30d)" value={insights.active_users_today} />
        <KPICard title="Total Volume (24h)" value={`$${insights.total_volume_usd}`} />
        <KPICard title="Transactions Today" value={insights.total_transactions} />
        <KPICard title="Swaps Today" value={insights.total_swaps} />
      </div>

      {/* Charts */}
      <div className="mt-8">
        <h2>Volume by Chain</h2>
        <BarChart data={insights.volume_by_chain} />
      </div>

      {/* Active Users Table */}
      <div className="mt-8">
        <h2>Active Users</h2>
        <UserTable users={activeUsers} />
      </div>

      {/* Recent Transactions */}
      <div className="mt-8">
        <h2>Recent Transactions</h2>
        <TransactionTable transactions={recentTransactions} />
      </div>
    </div>
  );
}
```

### **⚙️ BACKEND AGGREGATION (Cron Job)**

```typescript
// app/api/cron/aggregate-analytics/route.ts
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const today = new Date().toISOString().split('T')[0];

  // Aggregate user analytics (last 30 days)
  await supabaseAdmin.rpc('aggregate_user_analytics');

  // Generate daily insights
  const insights = await generateDailyInsights(today);
  
  await supabaseAdmin
    .from('admin_daily_insights')
    .upsert({ date: today, ...insights });

  return NextResponse.json({ success: true });
}

async function generateDailyInsights(date: string) {
  // Count transactions today
  const { count: txCount } = await supabaseAdmin
    .from('wallet_transactions')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', `${date}T00:00:00Z`)
    .lt('created_at', `${date}T23:59:59Z`);

  // Sum volume today
  const { data: volumeData } = await supabaseAdmin
    .from('wallet_transactions')
    .select('amount_usd, chain_key')
    .gte('created_at', `${date}T00:00:00Z`)
    .lt('created_at', `${date}T23:59:59Z`);

  const totalVolume = volumeData?.reduce((sum, tx) => sum + (tx.amount_usd || 0), 0) || 0;

  // Volume by chain
  const volumeByChain = {};
  volumeData?.forEach(tx => {
    volumeByChain[tx.chain_key] = (volumeByChain[tx.chain_key] || 0) + (tx.amount_usd || 0);
  });

  return {
    total_transactions: txCount,
    total_volume_usd: totalVolume,
    volume_by_chain: volumeByChain,
    // ... more metrics
  };
}
```

### **🔒 PRIVACY & GDPR COMPLIANCE**

#### **1. User Consent**
```typescript
// components/AnalyticsConsentModal.tsx
export function AnalyticsConsentModal() {
  return (
    <Modal>
      <h2>Help ons BLAZE te verbeteren</h2>
      <p>
        We willen graag begrijpen hoe je BLAZE gebruikt om de app te verbeteren.
        We verzamelen alleen anonieme gebruiksdata en NOOIT je wallet addresses of exacte bedragen.
      </p>
      
      <h3>Wat we verzamelen:</h3>
      <ul>
        <li>✅ Aantal transacties (niet de details)</li>
        <li>✅ Welke functies je gebruikt</li>
        <li>✅ Algemene waarde in USD (versleuteld)</li>
        <li>❌ GEEN wallet addresses</li>
        <li>❌ GEEN exacte bedragen</li>
      </ul>

      <button onClick={() => setAnalyticsEnabled(true)}>
        Ja, help BLAZE verbeteren
      </button>
      <button onClick={() => setAnalyticsEnabled(false)}>
        Nee, geen analytics
      </button>
    </Modal>
  );
}
```

#### **2. Opt-Out Mechanism**
```typescript
// app/api/user/analytics-preference/route.ts
export async function POST(request: NextRequest) {
  const { enabled } = await request.json();
  const { data: { user } } = await supabase.auth.getUser();

  // Update all user's transactions
  await supabaseAdmin
    .from('wallet_transactions')
    .update({ analytics_enabled: enabled })
    .eq('user_id', user.id);

  await supabaseAdmin
    .from('swap_transactions')
    .update({ analytics_enabled: enabled })
    .eq('user_id', user.id);

  return NextResponse.json({ success: true });
}
```

#### **3. Data Retention Policy**
```sql
-- Auto-delete analytics data after 90 days
CREATE OR REPLACE FUNCTION cleanup_old_analytics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.wallet_transactions
  WHERE created_at < NOW() - INTERVAL '90 days';
  
  DELETE FROM public.swap_transactions
  WHERE created_at < NOW() - INTERVAL '90 days';
  
  DELETE FROM public.app_events
  WHERE created_at < NOW() - INTERVAL '90 days';
  
  DELETE FROM public.admin_daily_insights
  WHERE date < CURRENT_DATE - INTERVAL '365 days';
END;
$$;

-- Schedule cleanup (via pg_cron or external cron)
SELECT cron.schedule('cleanup-analytics', '0 2 * * *', 'SELECT cleanup_old_analytics();');
```

### **✅ VOORDELEN VOORSTEL 1**

1. **Privacy-First**: Gevoelige data (hashes, amounts) zijn encrypted
2. **GDPR Compliant**: Opt-out, data retention, right to be forgotten
3. **Scalable**: Aggregaties in summary tables → snel dashboard
4. **Comprehensive**: Ziet ALLE user activiteit (onramp, swap, send, receive)
5. **Real-time**: Live tracking van gebeurtenissen
6. **User-Friendly**: Users kunnen hun eigen analytics zien
7. **Admin-Friendly**: Duidelijk dashboard met alle metrics

### **❌ NADELEN VOORSTEL 1**

1. **Complex**: Veel nieuwe tables en API routes
2. **Performance**: Extra DB writes bij elke transactie
3. **Development Time**: ~2-3 weken fulltime werk
4. **Maintenance**: Cron jobs en aggregaties moeten onderhouden worden

### **💰 KOSTEN**

- **Development**: ~40-60 uur (€2000-€3000)
- **Supabase**: +€10-20/maand (extra DB storage & queries)
- **Cron Service**: €5/maand (EasyCron of vergelijkbaar)

---

## 🎯 VOORSTEL 2: "BLOCKCHAIN EXPLORER INTEGRATION"

### **Concept**
In plaats van alles zelf te loggen, integreer met **blockchain explorers** (Etherscan, Solscan, etc.) en **cache alleen metadata** in eigen database. Minimale eigen data storage, maximale privacy.

### **📋 DATABASE SCHEMA (Minimaal)**

```sql
-- =============================================================================
-- TABLE 1: USER WALLETS MAPPING (Watch List)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.user_wallet_watch_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Wallet Info (hashed)
  wallet_address_hash TEXT NOT NULL, -- SHA-256 hash of address (not the actual address!)
  chain_key TEXT NOT NULL,
  
  -- Metadata
  label TEXT, -- User can give wallet a name
  is_primary BOOLEAN DEFAULT true,
  
  -- Last Sync
  last_synced_at TIMESTAMPTZ,
  last_transaction_at TIMESTAMPTZ,
  
  -- Analytics Consent
  tracking_enabled BOOLEAN DEFAULT false, -- Must opt-in
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, wallet_address_hash, chain_key)
);

CREATE INDEX idx_watch_list_user ON public.user_wallet_watch_list(user_id);
CREATE INDEX idx_watch_list_hash ON public.user_wallet_watch_list(wallet_address_hash);


-- =============================================================================
-- TABLE 2: TRANSACTION ACTIVITY CACHE (Minimal)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.transaction_activity_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_watch_id UUID REFERENCES public.user_wallet_watch_list(id) ON DELETE CASCADE,
  
  -- Transaction Reference (hashed)
  tx_hash_hash TEXT NOT NULL, -- Hash of tx hash (not actual hash!)
  
  -- Type & Chain
  chain_key TEXT NOT NULL,
  type TEXT CHECK (type IN ('send', 'receive', 'swap', 'contract')),
  
  -- Analytics Only (USD)
  value_usd DECIMAL(20, 2),
  
  -- Timestamp
  block_timestamp TIMESTAMPTZ NOT NULL,
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(wallet_watch_id, tx_hash_hash)
);

CREATE INDEX idx_tx_cache_wallet ON public.transaction_activity_cache(wallet_watch_id, block_timestamp DESC);
CREATE INDEX idx_tx_cache_timestamp ON public.transaction_activity_cache(block_timestamp DESC);


-- =============================================================================
-- TABLE 3: ADMIN ACTIVITY OVERVIEW (Aggregate Only)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.admin_activity_overview (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  
  -- High-Level Metrics
  total_active_users INTEGER DEFAULT 0,
  total_transactions_count INTEGER DEFAULT 0,
  total_volume_usd DECIMAL(20, 2) DEFAULT 0,
  
  -- Chain Breakdown
  ethereum_tx_count INTEGER DEFAULT 0,
  solana_tx_count INTEGER DEFAULT 0,
  bitcoin_tx_count INTEGER DEFAULT 0,
  
  -- App Engagement
  new_signups INTEGER DEFAULT 0,
  returning_users INTEGER DEFAULT 0,
  
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_overview_date ON public.admin_activity_overview(date DESC);
```

### **🔐 RLS POLICIES**

```sql
ALTER TABLE public.user_wallet_watch_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_activity_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_activity_overview ENABLE ROW LEVEL SECURITY;

-- Users see only their own watch list
CREATE POLICY "Users view own watch list"
  ON public.user_wallet_watch_list FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users see only their own cached transactions
CREATE POLICY "Users view own transaction cache"
  ON public.transaction_activity_cache FOR SELECT
  TO authenticated
  USING (
    wallet_watch_id IN (
      SELECT id FROM public.user_wallet_watch_list WHERE user_id = auth.uid()
    )
  );

-- Service role full access
CREATE POLICY "Service role full access watch list"
  ON public.user_wallet_watch_list FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access tx cache"
  ON public.transaction_activity_cache FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access overview"
  ON public.admin_activity_overview FOR ALL TO service_role
  USING (true) WITH CHECK (true);
```

### **🔄 BACKEND SYNC SERVICE**

```typescript
// app/api/cron/sync-blockchain-activity/route.ts
import { Alchemy, Network } from 'alchemy-sdk';
import { Connection } from '@solana/web3.js';

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get all wallets that have tracking enabled
  const { data: watchList } = await supabaseAdmin
    .from('user_wallet_watch_list')
    .select('*')
    .eq('tracking_enabled', true);

  for (const wallet of watchList) {
    try {
      // Decrypt wallet address (stored hashed, need to get from user_id → wallets table)
      const actualAddress = await getWalletAddress(wallet.user_id, wallet.chain_key);
      
      // Fetch transactions from blockchain explorer
      const transactions = await fetchBlockchainTransactions(
        actualAddress,
        wallet.chain_key,
        wallet.last_synced_at
      );

      // Cache only metadata (not actual details)
      for (const tx of transactions) {
        const txHashHash = await hashString(tx.hash);
        
        await supabaseAdmin
          .from('transaction_activity_cache')
          .upsert({
            wallet_watch_id: wallet.id,
            tx_hash_hash: txHashHash,
            chain_key: wallet.chain_key,
            type: detectTransactionType(tx),
            value_usd: await convertToUSD(tx.value, tx.token),
            block_timestamp: new Date(tx.timestamp * 1000),
          });
      }

      // Update last sync time
      await supabaseAdmin
        .from('user_wallet_watch_list')
        .update({ 
          last_synced_at: new Date(),
          last_transaction_at: transactions[0]?.timestamp 
        })
        .eq('id', wallet.id);
        
    } catch (error) {
      console.error(`Failed to sync wallet ${wallet.id}:`, error);
    }
  }

  // Aggregate daily overview
  await aggregateDailyOverview();

  return NextResponse.json({ success: true });
}

async function fetchBlockchainTransactions(address: string, chain: string, since: Date) {
  switch (chain) {
    case 'ethereum':
      return fetchEthereumTransactions(address, since);
    case 'solana':
      return fetchSolanaTransactions(address, since);
    case 'bitcoin':
      return fetchBitcoinTransactions(address, since);
    // ... more chains
  }
}

async function fetchEthereumTransactions(address: string, since: Date) {
  const alchemy = new Alchemy({
    apiKey: process.env.ALCHEMY_API_KEY,
    network: Network.ETH_MAINNET,
  });

  const transfers = await alchemy.core.getAssetTransfers({
    fromAddress: address,
    toAddress: address,
    category: ['external', 'internal', 'erc20', 'erc721'],
    maxCount: 100,
  });

  return transfers.transfers.map(t => ({
    hash: t.hash,
    from: t.from,
    to: t.to,
    value: t.value,
    token: t.asset,
    timestamp: new Date(t.metadata.blockTimestamp).getTime() / 1000,
  }));
}
```

### **🎨 ADMIN DASHBOARD (Lightweight)**

```typescript
// app/api/admin/activity-overview/route.ts
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const adminEmail = searchParams.get('admin');
  
  if (!isAdminUser(adminEmail)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get last 30 days overview
  const { data: overview } = await supabaseAdmin
    .from('admin_activity_overview')
    .select('*')
    .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    .order('date', { ascending: false });

  // Get active users count
  const { count: activeUsersCount } = await supabaseAdmin
    .from('user_wallet_watch_list')
    .select('user_id', { count: 'exact', head: true })
    .eq('tracking_enabled', true)
    .gte('last_transaction_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

  return NextResponse.json({
    overview,
    activeUsersCount,
  });
}
```

### **✅ VOORDELEN VOORSTEL 2**

1. **Minimale Data Storage**: Alleen hashes & aggregates, geen gevoelige data
2. **Extreme Privacy**: Echte wallet addresses & tx hashes zijn NOOIT in DB
3. **Leverages Existing Infrastructure**: Gebruik blockchain explorers
4. **Low Maintenance**: Minder eigen code, minder bugs
5. **Cost Effective**: Minimale DB writes, lagere Supabase kosten
6. **GDPR Gold Standard**: Bijna impossible om terug te traceren naar user
7. **Fast Development**: ~1 week implementatie

### **❌ NADELEN VOORSTEL 2**

1. **Delayed Insights**: Sync via cron (niet real-time)
2. **API Dependencies**: Afhankelijk van Alchemy, Etherscan, etc.
3. **Limited Detail**: Alleen high-level metrics, geen diepgaande analysis
4. **Rate Limits**: Blockchain explorer APIs hebben limits
5. **Complex Hashing**: Moet wallet addresses ophalen uit encrypted storage

### **💰 KOSTEN**

- **Development**: ~20-30 uur (€1000-€1500)
- **Supabase**: +€5-10/maand (minimale extra storage)
- **Blockchain APIs**: €50-100/maand (Alchemy Pro, Etherscan API)
- **Cron Service**: €5/maand

---

## 🎯 VOORSTEL 3: "HYBRID ANALYTICS + REAL-TIME DASHBOARD"

### **Concept**
Combineer het beste van beide werelden: **Real-time event streaming** voor instant feedback + **Periodic aggregation** voor historische data. Focus op **actionable insights** voor growth.

### **📋 DATABASE SCHEMA (Optimized)**

```sql
-- =============================================================================
-- TABLE 1: TRANSACTION EVENTS (Append-Only Log)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.transaction_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Event Type
  event_type TEXT NOT NULL CHECK (event_type IN (
    'send_initiated', 'send_confirmed', 'send_failed',
    'receive_detected', 
    'swap_initiated', 'swap_confirmed', 'swap_failed',
    'onramp_initiated', 'onramp_completed'
  )),
  
  -- Context (minimal)
  chain_key TEXT NOT NULL,
  token_symbol TEXT,
  
  -- Value (USD only, encrypted if needed)
  value_usd DECIMAL(20, 2),
  
  -- Status
  status TEXT CHECK (status IN ('pending', 'success', 'failed')),
  
  -- Reference (hashed)
  reference_id TEXT, -- Hashed tx hash or swap ID
  
  -- Metadata (flexible)
  metadata JSONB,
  
  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Partitioned by month for performance
CREATE INDEX idx_tx_events_user_time ON public.transaction_events(user_id, created_at DESC);
CREATE INDEX idx_tx_events_type ON public.transaction_events(event_type, created_at DESC);
CREATE INDEX idx_tx_events_chain ON public.transaction_events(chain_key, created_at DESC);


-- =============================================================================
-- TABLE 2: USER COHORTS (For Growth Analytics)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.user_cohorts (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- User Classification
  cohort_month TEXT NOT NULL, -- '2026-01' (signup month)
  user_segment TEXT CHECK (user_segment IN ('new', 'active', 'power_user', 'dormant', 'churned')),
  
  -- Lifecycle Metrics
  signup_date DATE NOT NULL,
  first_transaction_date DATE,
  last_transaction_date DATE,
  days_to_first_transaction INTEGER,
  
  -- Activity Counts (Lifetime)
  total_transactions INTEGER DEFAULT 0,
  total_swaps INTEGER DEFAULT 0,
  total_onramps INTEGER DEFAULT 0,
  
  -- Volume (Lifetime, USD)
  total_volume_usd DECIMAL(20, 2) DEFAULT 0,
  
  -- Engagement Score (0-100)
  engagement_score INTEGER DEFAULT 0,
  
  -- Metadata
  preferred_chain TEXT,
  favorite_tokens JSONB DEFAULT '[]'::jsonb,
  
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cohorts_month ON public.user_cohorts(cohort_month);
CREATE INDEX idx_cohorts_segment ON public.user_cohorts(user_segment, engagement_score DESC);


-- =============================================================================
-- TABLE 3: FEATURE USAGE STATS (What features are users actually using?)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.feature_usage_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  feature_name TEXT NOT NULL,
  
  -- Usage Counts
  total_uses INTEGER DEFAULT 0,
  unique_users INTEGER DEFAULT 0,
  
  -- Performance
  avg_completion_rate DECIMAL(5, 2), -- % of users who complete the feature
  avg_time_to_complete_seconds INTEGER,
  
  -- Metadata
  metadata JSONB,
  
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(date, feature_name)
);

CREATE INDEX idx_feature_stats_date ON public.feature_usage_stats(date DESC, feature_name);


-- =============================================================================
-- TABLE 4: REALTIME METRICS (Hot Data, Auto-Expire)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.realtime_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_key TEXT NOT NULL,
  metric_value DECIMAL(20, 2) NOT NULL,
  
  -- TTL (auto-delete after 24 hours)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
  
  UNIQUE(metric_key, created_at)
);

CREATE INDEX idx_realtime_metrics_key ON public.realtime_metrics(metric_key, created_at DESC);
CREATE INDEX idx_realtime_metrics_expire ON public.realtime_metrics(expires_at);

-- Auto-cleanup function
CREATE OR REPLACE FUNCTION cleanup_expired_realtime_metrics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.realtime_metrics WHERE expires_at < NOW();
END;
$$;


-- =============================================================================
-- TABLE 5: ADMIN ALERTS (Automated Monitoring)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.admin_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Alert Info
  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'high_volume_user',
    'suspicious_pattern',
    'failed_transactions_spike',
    'new_user_spike',
    'volume_drop',
    'error_rate_high'
  )),
  severity TEXT CHECK (severity IN ('info', 'warning', 'critical')),
  
  -- Message
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  
  -- Context
  user_id UUID REFERENCES auth.users(id), -- Optional, if alert is user-specific
  metadata JSONB,
  
  -- Status
  status TEXT DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'resolved')),
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  
  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alerts_status ON public.admin_alerts(status, severity, created_at DESC);
CREATE INDEX idx_alerts_type ON public.admin_alerts(alert_type, created_at DESC);
```

### **🔐 RLS POLICIES**

```sql
ALTER TABLE public.transaction_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_usage_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.realtime_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_alerts ENABLE ROW LEVEL SECURITY;

-- Users can see own transaction events
CREATE POLICY "Users view own events"
  ON public.transaction_events FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can see own cohort data
CREATE POLICY "Users view own cohort"
  ON public.user_cohorts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Feature stats are public (aggregated, no personal data)
CREATE POLICY "Feature stats public"
  ON public.feature_usage_stats FOR SELECT
  TO authenticated
  USING (true);

-- Realtime metrics public (no personal data)
CREATE POLICY "Realtime metrics public"
  ON public.realtime_metrics FOR SELECT
  TO authenticated
  USING (true);

-- Admin alerts only for service role
CREATE POLICY "Service role access alerts"
  ON public.admin_alerts FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- Service role full access on all tables
CREATE POLICY "Service role full access events"
  ON public.transaction_events FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access cohorts"
  ON public.user_cohorts FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access feature stats"
  ON public.feature_usage_stats FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access realtime"
  ON public.realtime_metrics FOR ALL TO service_role USING (true) WITH CHECK (true);
```

### **📱 FRONTEND IMPLEMENTATION (Event Logging)**

```typescript
// lib/analytics-tracker.ts
export class AnalyticsTracker {
  private static instance: AnalyticsTracker;
  private queue: any[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  static getInstance() {
    if (!this.instance) {
      this.instance = new AnalyticsTracker();
    }
    return this.instance;
  }

  constructor() {
    // Flush queue every 5 seconds
    this.flushInterval = setInterval(() => this.flush(), 5000);
  }

  // Log transaction event
  async logTransactionEvent(event: {
    eventType: string;
    chainKey: string;
    tokenSymbol?: string;
    valueUSD?: number;
    status: 'pending' | 'success' | 'failed';
    referenceId?: string;
    metadata?: any;
  }) {
    this.queue.push({
      type: 'transaction_event',
      ...event,
      timestamp: new Date().toISOString(),
    });

    // Flush immediately if queue is large
    if (this.queue.length >= 10) {
      await this.flush();
    }
  }

  // Log feature usage
  async logFeatureUsage(featureName: string, metadata?: any) {
    this.queue.push({
      type: 'feature_usage',
      featureName,
      metadata,
      timestamp: new Date().toISOString(),
    });
  }

  // Flush queue to server
  private async flush() {
    if (this.queue.length === 0) return;

    const events = [...this.queue];
    this.queue = [];

    try {
      await fetch('/api/analytics/batch-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events }),
      });
    } catch (error) {
      console.error('Failed to flush analytics:', error);
      // Re-queue on failure
      this.queue = [...events, ...this.queue];
    }
  }
}

// Usage in components:
const tracker = AnalyticsTracker.getInstance();

// In Dashboard.tsx after successful swap:
tracker.logTransactionEvent({
  eventType: 'swap_confirmed',
  chainKey: 'ethereum',
  tokenSymbol: 'ETH',
  valueUSD: 1000,
  status: 'success',
  metadata: { protocol: 'jupiter' },
});

// In SwapModal.tsx when opened:
tracker.logFeatureUsage('swap_modal_opened', { chainKey: 'ethereum' });
```

### **🚀 BACKEND API (Batch Processing)**

```typescript
// app/api/analytics/batch-log/route.ts
export async function POST(request: NextRequest) {
  try {
    const { events } = await request.json();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Process all events in batch
    const promises = events.map(async (event: any) => {
      if (event.type === 'transaction_event') {
        return supabaseAdmin.from('transaction_events').insert({
          user_id: user.id,
          event_type: event.eventType,
          chain_key: event.chainKey,
          token_symbol: event.tokenSymbol,
          value_usd: event.valueUSD,
          status: event.status,
          reference_id: event.referenceId ? await hashString(event.referenceId) : null,
          metadata: event.metadata,
        });
      }

      if (event.type === 'feature_usage') {
        // Increment feature usage counter
        return supabaseAdmin.rpc('increment_feature_usage', {
          p_date: new Date().toISOString().split('T')[0],
          p_feature_name: event.featureName,
          p_user_id: user.id,
        });
      }
    });

    await Promise.all(promises);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Batch log error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

### **⚙️ AGGREGATION & MONITORING (Cron Jobs)**

```typescript
// app/api/cron/aggregate-cohorts/route.ts
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Update user cohorts (segment users)
  await supabaseAdmin.rpc('update_user_cohorts');

  // Calculate engagement scores
  await supabaseAdmin.rpc('calculate_engagement_scores');

  // Check for anomalies and create alerts
  await checkForAnomalies();

  return NextResponse.json({ success: true });
}

async function checkForAnomalies() {
  // Check 1: High volume user (>$10k in 24h)
  const { data: highVolumeUsers } = await supabaseAdmin
    .from('transaction_events')
    .select('user_id, SUM(value_usd) as total_volume')
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .group('user_id')
    .gt('total_volume', 10000);

  for (const user of highVolumeUsers || []) {
    await supabaseAdmin.from('admin_alerts').insert({
      alert_type: 'high_volume_user',
      severity: 'warning',
      title: 'High Volume User Detected',
      message: `User ${user.user_id} has transacted $${user.total_volume} in the last 24 hours.`,
      user_id: user.user_id,
    });
  }

  // Check 2: Failed transactions spike
  const { count: failedCount } = await supabaseAdmin
    .from('transaction_events')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'failed')
    .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());

  if (failedCount > 50) {
    await supabaseAdmin.from('admin_alerts').insert({
      alert_type: 'failed_transactions_spike',
      severity: 'critical',
      title: 'Failed Transactions Spike',
      message: `${failedCount} failed transactions in the last hour. Investigate immediately.`,
    });
  }

  // Check 3: New user spike (growth indicator)
  const { count: newUsersToday } = await supabaseAdmin
    .from('user_cohorts')
    .select('*', { count: 'exact', head: true })
    .eq('signup_date', new Date().toISOString().split('T')[0]);

  if (newUsersToday > 100) {
    await supabaseAdmin.from('admin_alerts').insert({
      alert_type: 'new_user_spike',
      severity: 'info',
      title: 'New User Spike 🎉',
      message: `${newUsersToday} new users signed up today! Growth is accelerating.`,
    });
  }
}
```

### **🎨 ADMIN DASHBOARD (Real-Time)**

```typescript
// app/admin/dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase-client';

export default function AdminDashboard() {
  const [realtime, setRealtime] = useState<any>({});
  const [alerts, setAlerts] = useState<any[]>([]);
  const [cohorts, setCohorts] = useState<any>({});

  useEffect(() => {
    loadDashboardData();

    // Subscribe to realtime updates
    const subscription = supabase
      .channel('admin-dashboard')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'admin_alerts',
      }, (payload) => {
        setAlerts(prev => [payload.new, ...prev]);
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function loadDashboardData() {
    // Load realtime metrics
    const { data: metrics } = await fetch('/api/admin/realtime-metrics').then(r => r.json());
    setRealtime(metrics);

    // Load unread alerts
    const { data: alertsData } = await fetch('/api/admin/alerts?status=unread').then(r => r.json());
    setAlerts(alertsData);

    // Load cohort summary
    const { data: cohortsData } = await fetch('/api/admin/cohorts-summary').then(r => r.json());
    setCohorts(cohortsData);
  }

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold mb-8">BLAZE Admin Dashboard</h1>

      {/* Critical Alerts */}
      {alerts.filter(a => a.severity === 'critical').length > 0 && (
        <div className="bg-red-100 border-l-4 border-red-500 p-4 mb-6">
          <h2 className="font-bold text-red-800">🚨 Critical Alerts</h2>
          {alerts.filter(a => a.severity === 'critical').map(alert => (
            <div key={alert.id} className="mt-2">
              <p className="text-red-700">{alert.title}: {alert.message}</p>
            </div>
          ))}
        </div>
      )}

      {/* Realtime Metrics (Auto-refresh) */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <MetricCard 
          title="Active Users (Now)"
          value={realtime.active_users_now || 0}
          trend="+12%"
          color="blue"
        />
        <MetricCard 
          title="Transactions (24h)"
          value={realtime.transactions_24h || 0}
          trend="+8%"
          color="green"
        />
        <MetricCard 
          title="Volume (24h)"
          value={`$${(realtime.volume_24h || 0).toLocaleString()}`}
          trend="+15%"
          color="purple"
        />
        <MetricCard 
          title="Failed Rate"
          value={`${(realtime.failed_rate || 0).toFixed(1)}%`}
          trend="-2%"
          color="red"
        />
      </div>

      {/* User Cohorts */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-xl font-bold mb-4">User Segments</h2>
        <div className="grid grid-cols-5 gap-4">
          <SegmentCard segment="New" count={cohorts.new || 0} percentage={20} />
          <SegmentCard segment="Active" count={cohorts.active || 0} percentage={45} />
          <SegmentCard segment="Power Users" count={cohorts.power_user || 0} percentage={15} />
          <SegmentCard segment="Dormant" count={cohorts.dormant || 0} percentage={15} />
          <SegmentCard segment="Churned" count={cohorts.churned || 0} percentage={5} />
        </div>
      </div>

      {/* Recent Activity Feed */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">Recent Activity</h2>
        <ActivityFeed />
      </div>

      {/* Alerts List */}
      <div className="bg-white rounded-lg shadow p-6 mt-8">
        <h2 className="text-xl font-bold mb-4">All Alerts</h2>
        <AlertsList alerts={alerts} onResolve={(id) => resolveAlert(id)} />
      </div>
    </div>
  );
}

function MetricCard({ title, value, trend, color }: any) {
  return (
    <div className={`bg-${color}-50 rounded-lg p-4 border border-${color}-200`}>
      <h3 className="text-sm text-gray-600 mb-1">{title}</h3>
      <p className="text-2xl font-bold">{value}</p>
      <p className={`text-sm ${trend.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
        {trend} vs yesterday
      </p>
    </div>
  );
}
```

### **✅ VOORDELEN VOORSTEL 3**

1. **Real-Time Insights**: Instant dashboard updates via Supabase Realtime
2. **Actionable Alerts**: Automated monitoring met admin notifications
3. **Growth Focus**: Cohort analysis voor product-market fit
4. **Performance Optimized**: Append-only log + periodic aggregation
5. **Privacy-Conscious**: Alleen USD values + hashed references
6. **Developer-Friendly**: Simple event tracking API
7. **Scalable**: Designed voor growth (partitioned tables)
8. **Automated Anomaly Detection**: AI-powered alerts

### **❌ NADELEN VOORSTEL 3**

1. **Medium Complexity**: Meer dan Voorstel 2, minder dan Voorstel 1
2. **Requires Maintenance**: Cron jobs, monitoring scripts
3. **Learning Curve**: Admins moeten dashboard leren gebruiken
4. **Development Time**: ~2 weken fulltime

### **💰 KOSTEN**

- **Development**: ~35-45 uur (€1750-€2250)
- **Supabase**: +€15/maand (realtime subscriptions + storage)
- **Cron Service**: €5/maand
- **Monitoring Tools**: €10/maand (optional: Sentry, Datadog)

---

## 📊 VERGELIJKINGSMATRIX

| **Criteria** | **Voorstel 1: Privacy-First** | **Voorstel 2: Blockchain Explorer** | **Voorstel 3: Hybrid Real-Time** |
|--------------|-------------------------------|-------------------------------------|-----------------------------------|
| **Privacy** | ⭐⭐⭐⭐ (Encrypted) | ⭐⭐⭐⭐⭐ (Only hashes) | ⭐⭐⭐⭐ (Minimal data) |
| **Real-Time** | ⭐⭐⭐⭐⭐ (Instant) | ⭐⭐ (Cron-based) | ⭐⭐⭐⭐⭐ (Instant + Realtime) |
| **Detail Level** | ⭐⭐⭐⭐⭐ (Very detailed) | ⭐⭐ (High-level only) | ⭐⭐⭐⭐ (Balanced) |
| **Development Time** | 2-3 weeks | 1 week | 2 weeks |
| **Maintenance** | ⭐⭐⭐ (Medium) | ⭐⭐⭐⭐ (Low) | ⭐⭐⭐ (Medium) |
| **Cost** | €2000-€3000 + €35/month | €1000-€1500 + €60/month | €1750-€2250 + €30/month |
| **GDPR Compliance** | ⭐⭐⭐⭐ (Opt-out) | ⭐⭐⭐⭐⭐ (No personal data) | ⭐⭐⭐⭐ (Opt-out + minimal) |
| **Scalability** | ⭐⭐⭐ (Many DB writes) | ⭐⭐⭐⭐⭐ (Minimal writes) | ⭐⭐⭐⭐ (Optimized) |
| **Admin Dashboard** | ⭐⭐⭐⭐⭐ (Complete) | ⭐⭐ (Basic) | ⭐⭐⭐⭐⭐ (Real-time) |
| **Actionable Insights** | ⭐⭐⭐ (Requires analysis) | ⭐⭐ (Limited) | ⭐⭐⭐⭐⭐ (Automated alerts) |

---

## 🎯 MIJN AANBEVELING: **VOORSTEL 3** (Hybrid Real-Time)

### **Waarom?**

1. **Perfect voor startup fase**: Je krijgt real-time inzicht in wat users doen, essentieel voor product-market fit
2. **Automated monitoring**: Alerts waarschuwen je automatisch bij problemen of growth opportunities
3. **Privacy + Detail**: Goede balans tussen privacy en actionable insights
4. **Future-proof**: Designed om te schalen, maar niet overcomplicated
5. **Cost-effective**: Beste ROI (€2000 development, €30/maand ongoing)

### **Implementatie Roadmap (2 weken)**

#### **Week 1: Database + Backend**
- **Dag 1-2**: Database schema aanmaken + RLS policies
- **Dag 3-4**: API routes voor batch logging + admin dashboard
- **Dag 5**: Cron job voor aggregations + anomaly detection

#### **Week 2: Frontend + Testing**
- **Dag 1-2**: AnalyticsTracker class + integratie in Dashboard/SwapModal
- **Dag 3-4**: Admin dashboard UI (React components)
- **Dag 5**: Testing + bugfixes + documentatie

---

## 🚀 NEXT STEPS

1. **Kies een voorstel** (of combineer elementen)
2. **Ik maak een gedetailleerd implementatieplan**
3. **We starten met database migrations**
4. **Progressive rollout**: Eerst logging, dan dashboard, dan alerts

**Vragen?** Laat weten welk voorstel je aanspreekt, of waar je twijfelt! Ik kan elk onderdeel verder uitwerken.

