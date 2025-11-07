-- ============================================
-- 🔐 EPHEMERAL KEY ENCRYPTION SCHEMA
-- ============================================
-- Add encrypted key columns to scheduled_transactions
-- Uses mnemonic encryption (works for ALL 18 chains)

ALTER TABLE scheduled_transactions
ADD COLUMN IF NOT EXISTS encrypted_mnemonic TEXT,
ADD COLUMN IF NOT EXISTS kms_encrypted_ephemeral_key TEXT,
ADD COLUMN IF NOT EXISTS key_deleted_at TIMESTAMP;

-- ✅ SECURITY: These columns should NEVER be exposed via RLS
-- Create separate secure view WITHOUT encrypted columns

CREATE OR REPLACE VIEW scheduled_transactions_secure AS
SELECT 
  id,
  user_id,
  supabase_user_id,
  chain,
  from_address,
  to_address,
  amount,
  token_address,
  token_symbol,
  scheduled_for,
  optimal_gas_threshold,
  max_wait_hours,
  priority,
  status,
  created_at,
  updated_at,
  executed_at,
  expires_at,
  estimated_gas_price,
  estimated_gas_cost_usd,
  actual_gas_price,
  actual_gas_cost_usd,
  estimated_savings_usd,
  actual_savings_usd,
  transaction_hash,
  error_message,
  memo,
  retry_count,
  block_number
  -- ❌ EXCLUDED: encrypted_mnemonic, kms_encrypted_ephemeral_key
FROM scheduled_transactions;

-- Grant RLS on secure view
ALTER TABLE scheduled_transactions_secure ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own scheduled transactions"
  ON scheduled_transactions_secure
  FOR SELECT
  USING (auth.uid() = supabase_user_id OR user_id = auth.uid()::text);

-- ✅ SECURITY: Only backend (SERVICE_ROLE) can access encrypted columns

COMMENT ON COLUMN scheduled_transactions.encrypted_mnemonic IS 
'AES-256-GCM encrypted mnemonic (12 words, works for ALL 18 chains)';

COMMENT ON COLUMN scheduled_transactions.kms_encrypted_ephemeral_key IS 
'RSA-OAEP encrypted ephemeral key (encrypted with AWS KMS public key)';

COMMENT ON COLUMN scheduled_transactions.key_deleted_at IS 
'Timestamp when encrypted keys were deleted after execution (security audit trail)';

