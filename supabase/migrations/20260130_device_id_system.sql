-- ============================================================================
-- Device ID System Migration
-- Adds persistent device_id for stable device identification
-- Adds session tracking for grace period
-- Adds security event logging
-- ============================================================================

-- Add device_id column (persistent UUID for each device)
ALTER TABLE trusted_devices ADD COLUMN IF NOT EXISTS device_id TEXT;

-- Add session tracking for grace period
ALTER TABLE trusted_devices ADD COLUMN IF NOT EXISTS session_token TEXT;
ALTER TABLE trusted_devices ADD COLUMN IF NOT EXISTS last_verified_session_at TIMESTAMPTZ;

-- Add browser and OS version columns for better matching
ALTER TABLE trusted_devices ADD COLUMN IF NOT EXISTS browser_version TEXT;
ALTER TABLE trusted_devices ADD COLUMN IF NOT EXISTS os_version TEXT;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_trusted_devices_device_id 
  ON trusted_devices(device_id);

CREATE INDEX IF NOT EXISTS idx_trusted_devices_user_device 
  ON trusted_devices(user_id, device_id);

CREATE INDEX IF NOT EXISTS idx_trusted_devices_session 
  ON trusted_devices(session_token) 
  WHERE session_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_trusted_devices_fingerprint_user
  ON trusted_devices(device_fingerprint, user_id);

-- Backfill existing devices with device_id (generate UUIDs)
UPDATE trusted_devices 
SET device_id = gen_random_uuid()::text 
WHERE device_id IS NULL;

-- Add unique constraint (device_id should be unique globally)
-- Note: IF NOT EXISTS not supported with ADD CONSTRAINT, using DO block
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'unique_device_id' 
    AND conrelid = 'trusted_devices'::regclass
  ) THEN
    ALTER TABLE trusted_devices ADD CONSTRAINT unique_device_id UNIQUE (device_id);
  END IF;
END $$;

-- Create security_events table for logging
CREATE TABLE IF NOT EXISTS security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id UUID REFERENCES trusted_devices(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_events_user 
  ON security_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_events_type
  ON security_events(event_type, created_at DESC);

-- Enable RLS on security_events
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own security events
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'security_events' 
    AND policyname = 'Users can view their own security events'
  ) THEN
    CREATE POLICY "Users can view their own security events"
      ON security_events FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Function to log security events
CREATE OR REPLACE FUNCTION log_security_event(
  p_user_id UUID,
  p_device_id UUID,
  p_event_type TEXT,
  p_severity TEXT,
  p_details JSONB
) RETURNS VOID AS $$
BEGIN
  INSERT INTO security_events (user_id, device_id, event_type, severity, details, created_at)
  VALUES (p_user_id, p_device_id, p_event_type, p_severity, p_details, NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up old security events (keep last 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_security_events() RETURNS VOID AS $$
BEGIN
  DELETE FROM security_events 
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment for documentation
COMMENT ON COLUMN trusted_devices.device_id IS 'Persistent UUID for stable device identification (stored in localStorage)';
COMMENT ON COLUMN trusted_devices.session_token IS 'Short-lived token for grace period (1 hour)';
COMMENT ON COLUMN trusted_devices.last_verified_session_at IS 'Timestamp of last successful verification session';
COMMENT ON TABLE security_events IS 'Security event log for anomaly detection and auditing';

