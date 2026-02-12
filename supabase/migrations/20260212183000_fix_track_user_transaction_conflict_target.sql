-- Fix incorrect ON CONFLICT target in track_user_transaction
-- Previous version referenced p_tx_hash instead of tx_hash.

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
  ON CONFLICT (user_id, chain_key, tx_hash)
  DO UPDATE SET
    status = EXCLUDED.status,
    block_number = COALESCE(EXCLUDED.block_number, user_transactions.block_number),
    amount_usd = COALESCE(EXCLUDED.amount_usd, user_transactions.amount_usd),
    gas_used = COALESCE(EXCLUDED.gas_used, user_transactions.gas_used),
    gas_cost_usd = COALESCE(EXCLUDED.gas_cost_usd, user_transactions.gas_cost_usd),
    updated_at = NOW()
  RETURNING id INTO v_transaction_id;

  SELECT * INTO v_current_stats
  FROM user_transaction_stats
  WHERE user_id = p_user_id;

  IF v_current_stats.user_id IS NULL THEN
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

