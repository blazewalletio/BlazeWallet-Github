-- Add verification_code and device_metadata to trusted_devices table
-- Migration for Fort Knox Device Verification

-- Add new columns if they don't exist
ALTER TABLE trusted_devices 
ADD COLUMN IF NOT EXISTS verification_code TEXT,
ADD COLUMN IF NOT EXISTS device_metadata JSONB;

-- Create index for faster verification code lookups
CREATE INDEX IF NOT EXISTS idx_trusted_devices_verification_code 
ON trusted_devices(verification_code) 
WHERE verification_code IS NOT NULL;

-- Add comment to table
COMMENT ON COLUMN trusted_devices.verification_code IS '6-digit code sent via email for device verification';
COMMENT ON COLUMN trusted_devices.device_metadata IS 'Additional device info: location, risk score, flags (TOR, VPN, etc.)';

-- Update existing devices to have empty metadata
UPDATE trusted_devices 
SET device_metadata = '{}'::jsonb 
WHERE device_metadata IS NULL;

