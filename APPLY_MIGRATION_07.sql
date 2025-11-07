-- ============================================
-- 🔥 BLAZE WALLET - EPHEMERAL KEY MIGRATION
-- ============================================
-- Run this in Supabase SQL Editor
-- ============================================

-- Step 1: Add encrypted key columns
ALTER TABLE scheduled_transactions
ADD COLUMN IF NOT EXISTS encrypted_mnemonic TEXT,
ADD COLUMN IF NOT EXISTS kms_encrypted_ephemeral_key TEXT,
ADD COLUMN IF NOT EXISTS key_deleted_at TIMESTAMP;

-- Step 2: Add comments
COMMENT ON COLUMN scheduled_transactions.encrypted_mnemonic IS 
'AES-256-GCM encrypted mnemonic (12 words, works for ALL 18 chains)';

COMMENT ON COLUMN scheduled_transactions.kms_encrypted_ephemeral_key IS 
'RSA-OAEP encrypted ephemeral key (encrypted with AWS KMS public key)';

COMMENT ON COLUMN scheduled_transactions.key_deleted_at IS 
'Timestamp when encrypted keys were deleted after execution (security audit trail)';

-- Step 3: Verify columns were added
SELECT 
  column_name, 
  data_type, 
  col_description('scheduled_transactions'::regclass, ordinal_position) as description
FROM information_schema.columns
WHERE table_name = 'scheduled_transactions'
  AND column_name IN ('encrypted_mnemonic', 'kms_encrypted_ephemeral_key', 'key_deleted_at')
ORDER BY ordinal_position;

-- ✅ Expected output: 3 rows showing the new columns

