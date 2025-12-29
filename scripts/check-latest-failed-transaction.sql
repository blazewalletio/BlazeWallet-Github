-- Check latest failed transaction with full error details
SELECT 
  id,
  chain,
  amount,
  token_symbol,
  status,
  error_message,
  retry_count,
  encrypted_mnemonic IS NOT NULL as has_encrypted_mnemonic,
  kms_encrypted_ephemeral_key IS NOT NULL as has_kms_key,
  scheduled_for,
  expires_at,
  created_at,
  updated_at,
  -- Show time until execution (if still pending)
  CASE 
    WHEN scheduled_for IS NULL THEN 'Immediate'
    WHEN scheduled_for <= NOW() THEN 'Ready now'
    ELSE scheduled_for::text
  END as execution_status
FROM scheduled_transactions
WHERE status IN ('failed', 'pending')
  AND updated_at >= NOW() - INTERVAL '2 hours'
ORDER BY updated_at DESC
LIMIT 5;

