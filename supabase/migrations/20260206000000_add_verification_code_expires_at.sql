-- Add verification_code_expires_at column to trusted_devices table
-- For email verification code expiry tracking

ALTER TABLE trusted_devices 
ADD COLUMN IF NOT EXISTS verification_code_expires_at TIMESTAMPTZ;

-- Create index for faster expiry lookups
CREATE INDEX IF NOT EXISTS idx_trusted_devices_verification_code_expires 
ON trusted_devices(verification_code_expires_at) 
WHERE verification_code_expires_at IS NOT NULL;

-- Add comment
COMMENT ON COLUMN trusted_devices.verification_code_expires_at IS 'Expiry timestamp for email verification code (6-digit code)';

