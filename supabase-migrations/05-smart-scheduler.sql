-- ============================================================================
-- 🔥 BLAZE WALLET - SMART SCHEDULER MIGRATION
-- ============================================================================
-- 
-- Features:
-- - Scheduled transactions (one-time)
-- - Recurring sends (daily, weekly, monthly)
-- - Gas price alerts
-- - Savings tracking
-- - Multi-chain support (all 18 chains)
-- 
-- Tables:
-- 1. scheduled_transactions - Pending/completed scheduled sends
-- 2. recurring_sends - Recurring payment configurations
-- 3. gas_alerts - User-defined gas price alerts
-- 4. transaction_savings - Savings tracking per transaction
-- 5. user_savings_stats - Aggregated savings per user
-- 
-- ============================================================================

-- ============================================================================
-- TABLE 1: SCHEDULED TRANSACTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS scheduled_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User & Chain
  user_id TEXT NOT NULL,
  supabase_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  chain TEXT NOT NULL,
  
  -- Transaction Details
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  amount TEXT NOT NULL,
  token_address TEXT, -- NULL = native currency
  token_symbol TEXT,
  
  -- Scheduling Configuration
  scheduled_for TIMESTAMP, -- Specific time
  optimal_gas_threshold NUMERIC, -- Execute when gas <= X gwei/lamports/sat
  max_wait_hours INTEGER DEFAULT 24, -- Don't wait longer than X hours
  priority TEXT DEFAULT 'standard' CHECK (priority IN ('low', 'standard', 'high', 'instant')),
  
  -- Status & Execution
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'executing', 'completed', 'failed', 'cancelled', 'expired')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  executed_at TIMESTAMP,
  expires_at TIMESTAMP, -- Auto-cancel after this time
  
  -- Gas & Savings
  estimated_gas_price NUMERIC, -- Expected gas price when scheduled
  estimated_gas_cost_usd NUMERIC,
  actual_gas_price NUMERIC, -- Actual gas price when executed
  actual_gas_cost_usd NUMERIC,
  estimated_savings_usd NUMERIC,
  actual_savings_usd NUMERIC,
  
  -- Transaction Result
  transaction_hash TEXT,
  block_number BIGINT,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Metadata
  memo TEXT, -- User note
  notification_sent BOOLEAN DEFAULT FALSE,
  
  -- Indexes for performance
  CONSTRAINT scheduled_transactions_user_idx UNIQUE (user_id, created_at, id)
);

-- Indexes for fast queries
CREATE INDEX idx_scheduled_transactions_user ON scheduled_transactions(user_id, status);
CREATE INDEX idx_scheduled_transactions_status ON scheduled_transactions(status, scheduled_for);
CREATE INDEX idx_scheduled_transactions_chain ON scheduled_transactions(chain, status);
CREATE INDEX idx_scheduled_transactions_expires ON scheduled_transactions(expires_at) WHERE status = 'pending';

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_scheduled_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER scheduled_transactions_updated_at
  BEFORE UPDATE ON scheduled_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_scheduled_transactions_updated_at();

-- ============================================================================
-- TABLE 2: RECURRING SENDS
-- ============================================================================

CREATE TABLE IF NOT EXISTS recurring_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User & Chain
  user_id TEXT NOT NULL,
  supabase_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  chain TEXT NOT NULL,
  
  -- Transaction Details
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  amount TEXT NOT NULL,
  token_address TEXT,
  token_symbol TEXT,
  
  -- Recurrence Configuration
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'biweekly', 'monthly')),
  start_date DATE NOT NULL,
  end_date DATE, -- NULL = indefinite
  next_execution TIMESTAMP NOT NULL,
  
  -- Optimization
  use_optimal_timing BOOLEAN DEFAULT TRUE, -- Execute at optimal gas time within day
  max_gas_threshold NUMERIC, -- Skip if gas > X (wait for next cycle)
  preferred_time_utc TIME, -- Preferred execution time if not using optimal
  
  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Execution History
  total_executions INTEGER DEFAULT 0,
  successful_executions INTEGER DEFAULT 0,
  failed_executions INTEGER DEFAULT 0,
  last_execution_at TIMESTAMP,
  last_transaction_hash TEXT,
  
  -- Savings
  total_savings_usd NUMERIC DEFAULT 0,
  average_savings_per_tx_usd NUMERIC DEFAULT 0,
  
  -- Metadata
  label TEXT, -- User-friendly name
  notification_enabled BOOLEAN DEFAULT TRUE
);

-- Indexes
CREATE INDEX idx_recurring_sends_user ON recurring_sends(user_id, status);
CREATE INDEX idx_recurring_sends_next_execution ON recurring_sends(next_execution) WHERE status = 'active';
CREATE INDEX idx_recurring_sends_chain ON recurring_sends(chain, status);

-- Auto-update updated_at
CREATE TRIGGER recurring_sends_updated_at
  BEFORE UPDATE ON recurring_sends
  FOR EACH ROW
  EXECUTE FUNCTION update_scheduled_transactions_updated_at();

-- ============================================================================
-- TABLE 3: GAS ALERTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS gas_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User & Chain
  user_id TEXT NOT NULL,
  supabase_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  chain TEXT NOT NULL,
  
  -- Alert Configuration
  target_gas_price NUMERIC NOT NULL, -- Alert when gas <= X
  alert_type TEXT DEFAULT 'instant' CHECK (alert_type IN ('instant', 'daily_summary')),
  
  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'triggered', 'expired')),
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  
  -- Trigger History
  last_triggered_at TIMESTAMP,
  trigger_count INTEGER DEFAULT 0,
  
  -- Transaction Context (optional - user can associate alert with planned tx)
  transaction_context JSONB, -- {to, amount, token, etc}
  
  -- Notification
  notification_sent BOOLEAN DEFAULT FALSE
);

-- Indexes
CREATE INDEX idx_gas_alerts_user ON gas_alerts(user_id, status);
CREATE INDEX idx_gas_alerts_chain ON gas_alerts(chain, status);
CREATE INDEX idx_gas_alerts_active ON gas_alerts(status, chain) WHERE status = 'active';

-- ============================================================================
-- TABLE 4: TRANSACTION SAVINGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS transaction_savings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User & Transaction
  user_id TEXT NOT NULL,
  supabase_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  chain TEXT NOT NULL,
  transaction_hash TEXT NOT NULL,
  
  -- Gas Details
  gas_price_used NUMERIC NOT NULL,
  gas_price_peak_24h NUMERIC,
  gas_price_avg_24h NUMERIC,
  gas_cost_usd NUMERIC NOT NULL,
  
  -- Savings Calculation
  baseline_gas_cost_usd NUMERIC, -- What it would have cost at avg gas
  savings_usd NUMERIC, -- Positive = saved money, negative = paid more
  savings_percentage NUMERIC,
  
  -- Timing
  executed_at TIMESTAMP DEFAULT NOW(),
  was_scheduled BOOLEAN DEFAULT FALSE,
  scheduled_transaction_id UUID REFERENCES scheduled_transactions(id),
  
  -- Classification
  transaction_type TEXT, -- 'transfer', 'swap', 'contract'
  optimal_timing BOOLEAN DEFAULT FALSE -- Was this executed at optimal time?
);

-- Indexes
CREATE INDEX idx_transaction_savings_user ON transaction_savings(user_id, executed_at DESC);
CREATE INDEX idx_transaction_savings_chain ON transaction_savings(chain);
CREATE INDEX idx_transaction_savings_hash ON transaction_savings(transaction_hash);

-- ============================================================================
-- TABLE 5: USER SAVINGS STATS (Aggregated)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_savings_stats (
  user_id TEXT PRIMARY KEY,
  supabase_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Overall Stats
  total_transactions INTEGER DEFAULT 0,
  scheduled_transactions INTEGER DEFAULT 0,
  
  -- Savings
  total_savings_usd NUMERIC DEFAULT 0,
  average_savings_per_tx_usd NUMERIC DEFAULT 0,
  best_single_saving_usd NUMERIC DEFAULT 0,
  
  -- Per Chain (JSONB for flexibility)
  savings_per_chain JSONB DEFAULT '{}',
  
  -- Time-based
  savings_this_month_usd NUMERIC DEFAULT 0,
  savings_last_month_usd NUMERIC DEFAULT 0,
  savings_this_year_usd NUMERIC DEFAULT 0,
  
  -- Rankings
  percentile NUMERIC, -- Top X% of savers
  
  -- Metadata
  first_transaction_at TIMESTAMP,
  last_transaction_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Auto-update updated_at
CREATE TRIGGER user_savings_stats_updated_at
  BEFORE UPDATE ON user_savings_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_scheduled_transactions_updated_at();

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function: Get next execution time for recurring send
CREATE OR REPLACE FUNCTION calculate_next_execution(
  p_frequency TEXT,
  p_last_execution TIMESTAMP,
  p_preferred_time_utc TIME DEFAULT '00:00:00'
)
RETURNS TIMESTAMP AS $$
DECLARE
  v_next TIMESTAMP;
BEGIN
  CASE p_frequency
    WHEN 'daily' THEN
      v_next := (DATE(p_last_execution) + INTERVAL '1 day') + p_preferred_time_utc;
    WHEN 'weekly' THEN
      v_next := (DATE(p_last_execution) + INTERVAL '7 days') + p_preferred_time_utc;
    WHEN 'biweekly' THEN
      v_next := (DATE(p_last_execution) + INTERVAL '14 days') + p_preferred_time_utc;
    WHEN 'monthly' THEN
      v_next := (DATE(p_last_execution) + INTERVAL '1 month') + p_preferred_time_utc;
    ELSE
      v_next := p_last_execution + INTERVAL '1 day';
  END CASE;
  
  RETURN v_next;
END;
$$ LANGUAGE plpgsql;

-- Function: Update user savings stats (call after each transaction)
CREATE OR REPLACE FUNCTION update_user_savings_stats(
  p_user_id TEXT,
  p_supabase_user_id UUID,
  p_chain TEXT,
  p_savings_usd NUMERIC,
  p_was_scheduled BOOLEAN
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO user_savings_stats (
    user_id,
    supabase_user_id,
    total_transactions,
    scheduled_transactions,
    total_savings_usd,
    best_single_saving_usd,
    savings_per_chain,
    first_transaction_at,
    last_transaction_at
  )
  VALUES (
    p_user_id,
    p_supabase_user_id,
    1,
    CASE WHEN p_was_scheduled THEN 1 ELSE 0 END,
    p_savings_usd,
    p_savings_usd,
    jsonb_build_object(p_chain, p_savings_usd),
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    total_transactions = user_savings_stats.total_transactions + 1,
    scheduled_transactions = user_savings_stats.scheduled_transactions + 
      CASE WHEN p_was_scheduled THEN 1 ELSE 0 END,
    total_savings_usd = user_savings_stats.total_savings_usd + p_savings_usd,
    average_savings_per_tx_usd = (user_savings_stats.total_savings_usd + p_savings_usd) / 
      (user_savings_stats.total_transactions + 1),
    best_single_saving_usd = GREATEST(user_savings_stats.best_single_saving_usd, p_savings_usd),
    savings_per_chain = jsonb_set(
      COALESCE(user_savings_stats.savings_per_chain, '{}'::jsonb),
      ARRAY[p_chain],
      to_jsonb(COALESCE((user_savings_stats.savings_per_chain->p_chain)::numeric, 0) + p_savings_usd)
    ),
    last_transaction_at = NOW(),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function: Get ready-to-execute transactions (for cron job)
CREATE OR REPLACE FUNCTION get_ready_transactions()
RETURNS TABLE (
  id UUID,
  user_id TEXT,
  chain TEXT,
  from_address TEXT,
  to_address TEXT,
  amount TEXT,
  token_address TEXT,
  priority TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    st.id,
    st.user_id,
    st.chain,
    st.from_address,
    st.to_address,
    st.amount,
    st.token_address,
    st.priority
  FROM scheduled_transactions st
  WHERE st.status = 'pending'
    AND st.scheduled_for <= NOW()
    AND (st.expires_at IS NULL OR st.expires_at > NOW())
  ORDER BY st.priority DESC, st.scheduled_for ASC
  LIMIT 100;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE scheduled_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE gas_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_savings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_savings_stats ENABLE ROW LEVEL SECURITY;

-- Policies: Users can only see their own data
CREATE POLICY scheduled_transactions_user_policy ON scheduled_transactions
  FOR ALL USING (
    supabase_user_id = auth.uid() OR 
    user_id = current_setting('app.current_user_id', true)
  );

CREATE POLICY recurring_sends_user_policy ON recurring_sends
  FOR ALL USING (
    supabase_user_id = auth.uid() OR 
    user_id = current_setting('app.current_user_id', true)
  );

CREATE POLICY gas_alerts_user_policy ON gas_alerts
  FOR ALL USING (
    supabase_user_id = auth.uid() OR 
    user_id = current_setting('app.current_user_id', true)
  );

CREATE POLICY transaction_savings_user_policy ON transaction_savings
  FOR ALL USING (
    supabase_user_id = auth.uid() OR 
    user_id = current_setting('app.current_user_id', true)
  );

CREATE POLICY user_savings_stats_user_policy ON user_savings_stats
  FOR ALL USING (
    supabase_user_id = auth.uid() OR 
    user_id = current_setting('app.current_user_id', true)
  );

-- ============================================================================
-- INITIAL DATA / SAMPLE RECORDS
-- ============================================================================

-- None needed - tables are ready for production use

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE scheduled_transactions IS 'One-time scheduled transactions with optimal gas timing';
COMMENT ON TABLE recurring_sends IS 'Recurring payment configurations (daily, weekly, monthly)';
COMMENT ON TABLE gas_alerts IS 'User-defined gas price alerts for all chains';
COMMENT ON TABLE transaction_savings IS 'Historical savings tracking per transaction';
COMMENT ON TABLE user_savings_stats IS 'Aggregated savings statistics per user';

-- ============================================================================
-- TABLE 6: NOTIFICATIONS (for in-app notifications)
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User
  user_id TEXT NOT NULL,
  supabase_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Notification Details
  type TEXT NOT NULL CHECK (type IN ('transaction_executed', 'gas_alert', 'savings_milestone', 'transaction_failed', 'recurring_executed')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  
  -- Status
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_notifications_user ON notifications(user_id, read, created_at DESC);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);

-- RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_user_policy ON notifications
  FOR ALL USING (
    supabase_user_id = auth.uid() OR 
    user_id = current_setting('app.current_user_id', true)
  );

COMMENT ON TABLE notifications IS 'In-app notifications for Smart Send events';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================

