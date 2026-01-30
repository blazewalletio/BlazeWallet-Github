-- ============================================================================
-- 📊 TRANSACTION TRACKING SYSTEM
-- Track ALL transactions (sent/received) cross-device in real-time
-- ============================================================================

-- ============================================================================
-- 1. USER TRANSACTIONS TABLE - Detailed transaction log
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Transaction Details
  chain_key VARCHAR(50) NOT NULL,
  tx_hash VARCHAR(255) NOT NULL,
  block_number BIGINT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Type & Direction
  transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('send', 'receive', 'swap', 'contract')),
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('sent', 'received')),
  
  -- Addresses
  from_address VARCHAR(255) NOT NULL,
  to_address VARCHAR(255) NOT NULL,
  
  -- Token/Asset
  token_symbol VARCHAR(50),
  token_address VARCHAR(255),
  token_decimals INTEGER DEFAULT 18,
  is_native BOOLEAN DEFAULT false,
  
  -- Amount & Value
  amount DECIMAL(30, 18) NOT NULL,
  amount_usd DECIMAL(20, 2),
  
  -- Gas
  gas_used BIGINT,
  gas_price DECIMAL(30, 18),
  gas_cost_usd DECIMAL(20, 4),
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'failed')),
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, chain_key, tx_hash)
);

CREATE INDEX IF NOT EXISTS idx_user_transactions_user_time ON user_transactions(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_user_transactions_chain ON user_transactions(chain_key);
CREATE INDEX IF NOT EXISTS idx_user_transactions_hash ON user_transactions(tx_hash);
CREATE INDEX IF NOT EXISTS idx_user_transactions_type ON user_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_user_transactions_status ON user_transactions(status);

ALTER TABLE user_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own transactions"
  ON user_transactions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own transactions"
  ON user_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role has full access"
  ON user_transactions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 2. FUNCTION TO TRACK TRANSACTION
-- ============================================================================

CREATE OR REPLACE FUNCTION track_user_transaction(
  p_user_id UUID,
  p_chain_key VARCHAR(50),
  p_tx_hash VARCHAR(255),
  p_transaction_type VARCHAR(20),
  p_direction VARCHAR(10),
  p_from_address VARCHAR(255),
  p_to_address VARCHAR(255),
  p_token_symbol VARCHAR(50) DEFAULT NULL,
  p_token_address VARCHAR(255) DEFAULT NULL,
  p_token_decimals INTEGER DEFAULT 18,
  p_is_native BOOLEAN DEFAULT false,
  p_amount DECIMAL(30, 18) DEFAULT 0,
  p_amount_usd DECIMAL(20, 2) DEFAULT NULL,
  p_gas_used BIGINT DEFAULT NULL,
  p_gas_price DECIMAL(30, 18) DEFAULT NULL,
  p_gas_cost_usd DECIMAL(20, 4) DEFAULT NULL,
  p_status VARCHAR(20) DEFAULT 'confirmed',
  p_block_number BIGINT DEFAULT NULL,
  p_timestamp TIMESTAMPTZ DEFAULT NOW(),
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_transaction_id UUID;
  v_current_stats RECORD;
BEGIN
  -- Insert transaction
  INSERT INTO user_transactions (
    user_id,
    chain_key,
    tx_hash,
    transaction_type,
    direction,
    from_address,
    to_address,
    token_symbol,
    token_address,
    token_decimals,
    is_native,
    amount,
    amount_usd,
    gas_used,
    gas_price,
    gas_cost_usd,
    status,
    block_number,
    timestamp,
    metadata
  )
  VALUES (
    p_user_id,
    p_chain_key,
    p_tx_hash,
    p_transaction_type,
    p_direction,
    p_from_address,
    p_to_address,
    p_token_symbol,
    p_token_address,
    p_token_decimals,
    p_is_native,
    p_amount,
    p_amount_usd,
    p_gas_used,
    p_gas_price,
    p_gas_cost_usd,
    p_status,
    p_block_number,
    p_timestamp,
    p_metadata
  )
  ON CONFLICT (user_id, chain_key, p_tx_hash) 
  DO UPDATE SET
    status = EXCLUDED.status,
    block_number = COALESCE(EXCLUDED.block_number, user_transactions.block_number),
    amount_usd = COALESCE(EXCLUDED.amount_usd, user_transactions.amount_usd),
    gas_used = COALESCE(EXCLUDED.gas_used, user_transactions.gas_used),
    gas_cost_usd = COALESCE(EXCLUDED.gas_cost_usd, user_transactions.gas_cost_usd),
    updated_at = NOW()
  RETURNING id INTO v_transaction_id;

  -- Update user_transaction_stats
  -- Get current stats
  SELECT * INTO v_current_stats
  FROM user_transaction_stats
  WHERE user_id = p_user_id;

  IF v_current_stats.user_id IS NULL THEN
    -- Create new stats record
    INSERT INTO user_transaction_stats (
      user_id,
      total_transactions,
      total_sent,
      total_received,
      total_gas_spent,
      last_transaction_at
    )
    VALUES (
      p_user_id,
      1,
      CASE WHEN p_direction = 'sent' THEN COALESCE(p_amount_usd, 0) ELSE 0 END,
      CASE WHEN p_direction = 'received' THEN COALESCE(p_amount_usd, 0) ELSE 0 END,
      COALESCE(p_gas_cost_usd, 0),
      p_timestamp
    );
  ELSE
    -- Update existing stats
    UPDATE user_transaction_stats
    SET
      total_transactions = total_transactions + 1,
      total_sent = total_sent + CASE WHEN p_direction = 'sent' THEN COALESCE(p_amount_usd, 0) ELSE 0 END,
      total_received = total_received + CASE WHEN p_direction = 'received' THEN COALESCE(p_amount_usd, 0) ELSE 0 END,
      total_gas_spent = total_gas_spent + COALESCE(p_gas_cost_usd, 0),
      last_transaction_at = GREATEST(last_transaction_at, p_timestamp),
      updated_at = NOW()
    WHERE user_id = p_user_id;
  END IF;

  -- Log activity
  PERFORM log_user_activity(
    p_user_id,
    'transaction',
    format('%s %s on %s', 
      CASE WHEN p_direction = 'sent' THEN 'Sent' ELSE 'Received' END,
      p_token_symbol,
      p_chain_key
    ),
    NULL,
    NULL,
    jsonb_build_object(
      'chain', p_chain_key,
      'tx_hash', p_tx_hash,
      'direction', p_direction,
      'amount_usd', p_amount_usd
    )
  );

  RETURN v_transaction_id;
END;
$$;

GRANT EXECUTE ON FUNCTION track_user_transaction TO authenticated;
GRANT EXECUTE ON FUNCTION track_user_transaction TO service_role;

-- ============================================================================
-- 3. FUNCTION TO GET USER TRANSACTION STATS
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_transaction_stats(p_user_id UUID)
RETURNS TABLE (
  total_transactions INTEGER,
  total_volume_usd DECIMAL(20, 2),
  total_sent DECIMAL(20, 2),
  total_received DECIMAL(20, 2),
  total_gas_spent DECIMAL(20, 4),
  last_transaction_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(uts.total_transactions, 0)::INTEGER,
    (COALESCE(uts.total_sent, 0) + COALESCE(uts.total_received, 0))::DECIMAL(20, 2),
    COALESCE(uts.total_sent, 0)::DECIMAL(20, 2),
    COALESCE(uts.total_received, 0)::DECIMAL(20, 2),
    COALESCE(uts.total_gas_spent, 0)::DECIMAL(20, 4),
    uts.last_transaction_at
  FROM user_transaction_stats uts
  WHERE uts.user_id = p_user_id;
  
  -- If no stats exist, return zeros
  IF NOT FOUND THEN
    RETURN QUERY SELECT 0, 0.00::DECIMAL(20,2), 0.00::DECIMAL(20,2), 0.00::DECIMAL(20,2), 0.0000::DECIMAL(20,4), NULL::TIMESTAMPTZ;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION get_user_transaction_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_transaction_stats TO service_role;

-- ============================================================================
-- 4. UPDATE TRIGGER FOR TIMESTAMPS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_user_transaction_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_transaction_timestamp
  BEFORE UPDATE ON user_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_user_transaction_timestamp();

-- ============================================================================
-- 5. GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON user_transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON user_transaction_stats TO authenticated;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE user_transactions IS 'Detailed log of all user transactions (sent/received) across all chains';
COMMENT ON FUNCTION track_user_transaction IS 'Track a transaction and update user stats automatically';
COMMENT ON FUNCTION get_user_transaction_stats IS 'Get aggregated transaction statistics for a user';

