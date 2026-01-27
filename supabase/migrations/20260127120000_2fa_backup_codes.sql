-- ============================================================================
-- 2FA Backup Codes Migration
-- Adds backup_codes column to user_profiles for 2FA recovery
-- ============================================================================

-- Add backup codes column (stores SHA-256 hashes)
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS two_factor_backup_codes JSONB DEFAULT '[]';

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_2fa_enabled 
ON user_profiles(two_factor_enabled) 
WHERE two_factor_enabled = true;

-- Comment
COMMENT ON COLUMN user_profiles.two_factor_backup_codes IS 
'SHA-256 hashed backup codes for 2FA recovery. One-time use, removed after verification.';

-- Initialize existing rows
UPDATE user_profiles 
SET two_factor_backup_codes = '[]'::jsonb 
WHERE two_factor_backup_codes IS NULL;

