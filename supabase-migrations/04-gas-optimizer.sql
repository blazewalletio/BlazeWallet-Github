-- ============================================
-- 🔥 BLAZE WALLET - GAS OPTIMIZER TABLES
-- ============================================
-- 
-- Tables for Ultimate Gas Optimizer:
-- 1. gas_history - Historical gas prices (7-day rolling window)
-- 2. gas_alerts - User gas price alerts
-- 3. scheduled_transactions - Automated transaction scheduling
-- 4. user_savings - Track how much users saved
-- 
-- Author: Blaze Wallet Team
-- Date: 2025-11-04
-- ============================================

-- ============================================
-- 1. GAS HISTORY TABLE
-- ============================================
-- Stores historical gas prices for trend analysis

CREATE TABLE IF NOT EXISTS gas_history (
  id BIGSERIAL PRIMARY KEY,
  chain TEXT NOT NULL,
  
  -- Gas prices (in gwei for EVM, native units for others)
  base_fee DECIMAL(20, 6) NOT NULL,
  priority_fee DECIMAL(20, 6) NOT NULL,
  gas_price DECIMAL(20, 6) NOT NULL,
  
  -- Speed tiers
  slow DECIMAL(20, 6),
  standard DECIMAL(20, 6),
  fast DECIMAL(20, 6),
  instant DECIMAL(20, 6),
  
  -- Metadata
  block_number BIGINT,
  source TEXT, -- 'rpc', 'api', 'fallback'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast queries by chain and time
CREATE INDEX IF NOT EXISTS idx_gas_history_chain_time 
  ON gas_history(chain, created_at DESC);

-- Index for cleanup queries (delete old data)
CREATE INDEX IF NOT EXISTS idx_gas_history_created_at 
  ON gas_history(created_at);

-- Automatically delete data older than 7 days (keep db small)
CREATE OR REPLACE FUNCTION cleanup_old_gas_history()
RETURNS void AS $$
BEGIN
  DELETE FROM gas_history 
  WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 2. GAS ALERTS TABLE
-- ============================================
-- User-configured gas price alerts

CREATE TABLE IF NOT EXISTS gas_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL, -- wallet address or supabase user id
  chain TEXT NOT NULL,
  
  -- Alert configuration
  target_gas DECIMAL(20, 6) NOT NULL, -- Notify when gas drops below this
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Notification preferences
  notify_email BOOLEAN DEFAULT false,
  notify_push BOOLEAN DEFAULT true,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_triggered_at TIMESTAMPTZ,
  triggered_count INTEGER DEFAULT 0
);

-- Index for active alerts by user
CREATE INDEX IF NOT EXISTS idx_gas_alerts_user_active 
  ON gas_alerts(user_id, is_active);

-- Index for checking alerts by chain
CREATE INDEX IF NOT EXISTS idx_gas_alerts_chain_active 
  ON gas_alerts(chain, is_active) WHERE is_active = true;

-- ============================================
-- 3. SCHEDULED TRANSACTIONS TABLE
-- ============================================
-- Automated transaction submission when gas drops

CREATE TABLE IF NOT EXISTS scheduled_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  chain TEXT NOT NULL,
  
  -- Transaction data (unsigned)
  tx_data JSONB NOT NULL, -- {to, value, data, gasLimit}
  
  -- Scheduling configuration
  max_gas DECIMAL(20, 6) NOT NULL, -- Submit when gas drops below this
  expires_at TIMESTAMPTZ NOT NULL, -- Cancel if not submitted by this time
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'submitted', 'expired', 'cancelled'
  submitted_at TIMESTAMPTZ,
  tx_hash TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for active scheduled transactions
CREATE INDEX IF NOT EXISTS idx_scheduled_tx_status 
  ON scheduled_transactions(status, chain) WHERE status = 'pending';

-- Index for user's scheduled transactions
CREATE INDEX IF NOT EXISTS idx_scheduled_tx_user 
  ON scheduled_transactions(user_id, status);

-- ============================================
-- 4. USER SAVINGS TABLE
-- ============================================
-- Track how much money users saved using the optimizer

CREATE TABLE IF NOT EXISTS user_savings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  chain TEXT NOT NULL,
  
  -- Savings data
  gas_saved DECIMAL(20, 6) NOT NULL, -- Amount of gas saved (gwei)
  usd_saved DECIMAL(20, 2) NOT NULL, -- USD value saved
  
  -- Transaction reference
  tx_hash TEXT,
  original_gas DECIMAL(20, 6), -- What it would have cost
  actual_gas DECIMAL(20, 6), -- What it actually cost
  
  -- Metadata
  saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for user savings summary
CREATE INDEX IF NOT EXISTS idx_user_savings_user_time 
  ON user_savings(user_id, saved_at DESC);

-- ============================================
-- 5. RLS POLICIES (Security)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE gas_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE gas_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_savings ENABLE ROW LEVEL SECURITY;

-- Gas history: Public read, service write
CREATE POLICY "Gas history is publicly readable"
  ON gas_history FOR SELECT
  USING (true);

CREATE POLICY "Service can insert gas history"
  ON gas_history FOR INSERT
  WITH CHECK (true);

-- Gas alerts: Users can only manage their own alerts
CREATE POLICY "Users can view their own alerts"
  ON gas_alerts FOR SELECT
  USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can create their own alerts"
  ON gas_alerts FOR INSERT
  WITH CHECK (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can update their own alerts"
  ON gas_alerts FOR UPDATE
  USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can delete their own alerts"
  ON gas_alerts FOR DELETE
  USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Scheduled transactions: Users can only manage their own
CREATE POLICY "Users can view their own scheduled transactions"
  ON scheduled_transactions FOR SELECT
  USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can create their own scheduled transactions"
  ON scheduled_transactions FOR INSERT
  WITH CHECK (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can update their own scheduled transactions"
  ON scheduled_transactions FOR UPDATE
  USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can delete their own scheduled transactions"
  ON scheduled_transactions FOR DELETE
  USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- User savings: Users can only view their own savings
CREATE POLICY "Users can view their own savings"
  ON user_savings FOR SELECT
  USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Service can insert savings"
  ON user_savings FOR INSERT
  WITH CHECK (true);

-- ============================================
-- 6. HELPER FUNCTIONS
-- ============================================

-- Get gas statistics for a chain (last 24h)
CREATE OR REPLACE FUNCTION get_gas_stats_24h(p_chain TEXT)
RETURNS TABLE(
  avg_gas DECIMAL,
  min_gas DECIMAL,
  max_gas DECIMAL,
  current_gas DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    AVG(gas_price) as avg_gas,
    MIN(gas_price) as min_gas,
    MAX(gas_price) as max_gas,
    (SELECT gas_price FROM gas_history 
     WHERE chain = p_chain 
     ORDER BY created_at DESC 
     LIMIT 1) as current_gas
  FROM gas_history
  WHERE chain = p_chain
    AND created_at > NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user's total savings
CREATE OR REPLACE FUNCTION get_user_total_savings(p_user_id TEXT)
RETURNS TABLE(
  total_gas_saved DECIMAL,
  total_usd_saved DECIMAL,
  transaction_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(gas_saved), 0) as total_gas_saved,
    COALESCE(SUM(usd_saved), 0) as total_usd_saved,
    COUNT(*) as transaction_count
  FROM user_savings
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if any alerts should trigger for current gas price
CREATE OR REPLACE FUNCTION check_gas_alerts(p_chain TEXT, p_current_gas DECIMAL)
RETURNS TABLE(
  alert_id UUID,
  user_id TEXT,
  target_gas DECIMAL,
  notify_email BOOLEAN,
  notify_push BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    id,
    gas_alerts.user_id,
    gas_alerts.target_gas,
    gas_alerts.notify_email,
    gas_alerts.notify_push
  FROM gas_alerts
  WHERE chain = p_chain
    AND is_active = true
    AND target_gas >= p_current_gas
    AND (last_triggered_at IS NULL OR last_triggered_at < NOW() - INTERVAL '1 hour');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 7. SEED DATA (Optional - for testing)
-- ============================================

-- Insert some historical data for Ethereum (last 24h simulation)
-- This is optional and can be commented out in production

-- DO $$
-- DECLARE
--   i INTEGER;
--   base_gas DECIMAL := 25;
--   gas_variance DECIMAL;
-- BEGIN
--   FOR i IN 1..288 LOOP -- 288 = 24h * 12 (5-min intervals)
--     gas_variance := (RANDOM() * 20) - 10; -- +/- 10 gwei
--     
--     INSERT INTO gas_history (
--       chain,
--       base_fee,
--       priority_fee,
--       gas_price,
--       slow,
--       standard,
--       fast,
--       instant,
--       block_number,
--       source,
--       created_at
--     ) VALUES (
--       'ethereum',
--       base_gas + gas_variance,
--       2 + (RANDOM() * 2),
--       base_gas + gas_variance + 2,
--       base_gas + gas_variance - 5,
--       base_gas + gas_variance,
--       base_gas + gas_variance + 10,
--       base_gas + gas_variance + 20,
--       18000000 + (i * 20),
--       'seed',
--       NOW() - (INTERVAL '5 minutes' * (288 - i))
--     );
--   END LOOP;
-- END $$;

-- ============================================
-- MIGRATION COMPLETE ✅
-- ============================================
-- 
-- Next steps:
-- 1. Run this migration: psql -d your_db -f 04-gas-optimizer.sql
-- 2. Set up cron job to cleanup old data (call cleanup_old_gas_history() daily)
-- 3. Set up background worker to record gas prices every 12 seconds
-- 4. Set up alert checker to run every 30 seconds
-- ============================================

