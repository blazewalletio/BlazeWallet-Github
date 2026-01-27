-- ============================================================================
-- Complete RLS Policies for Device Verification (Fort Knox)
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow reading own devices for verification" ON trusted_devices;
DROP POLICY IF EXISTS "Users can read their own devices" ON trusted_devices;
DROP POLICY IF EXISTS "Users can insert their own devices" ON trusted_devices;
DROP POLICY IF EXISTS "Users can update their own devices" ON trusted_devices;
DROP POLICY IF EXISTS "Users can delete their own devices" ON trusted_devices;

-- ============================================================================
-- POLICY 1: Allow anon to read unverified devices (for validation)
-- ============================================================================
CREATE POLICY "Allow reading unverified devices for validation"
ON trusted_devices
FOR SELECT
TO anon
USING (
  verification_code IS NOT NULL 
  AND verified_at IS NULL
  AND verification_expires_at > NOW()
);

-- ============================================================================
-- POLICY 2: Authenticated users can read their own devices
-- ============================================================================
CREATE POLICY "Users can read their own devices"
ON trusted_devices
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- ============================================================================
-- POLICY 3: Authenticated users can insert their own devices
-- ============================================================================
CREATE POLICY "Users can insert their own devices"
ON trusted_devices
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- POLICY 4: Authenticated users can update their own devices
-- ============================================================================
CREATE POLICY "Users can update their own devices"
ON trusted_devices
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- POLICY 5: Authenticated users can delete their own devices
-- ============================================================================
CREATE POLICY "Users can delete their own devices"
ON trusted_devices
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- ============================================================================
-- POLICY 6: Service role can do everything (for backend operations)
-- ============================================================================
-- Note: service_role bypasses RLS by default, but we'll be explicit

-- ============================================================================
-- Indexes for performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_trusted_devices_user_verified 
ON trusted_devices(user_id, verified_at)
WHERE verified_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_trusted_devices_fingerprint_user
ON trusted_devices(device_fingerprint, user_id);

-- ============================================================================
-- Comments for documentation
-- ============================================================================
COMMENT ON POLICY "Allow reading unverified devices for validation" ON trusted_devices IS 
'Allows anon role to read devices during verification process. Required for /api/verify-device-code endpoint.';

COMMENT ON POLICY "Users can read their own devices" ON trusted_devices IS 
'Authenticated users can view all their registered devices.';

COMMENT ON POLICY "Users can insert their own devices" ON trusted_devices IS 
'Users can register new devices during sign-in process.';

COMMENT ON POLICY "Users can update their own devices" ON trusted_devices IS 
'Users can update device information (e.g., mark as verified, update last_used_at).';

COMMENT ON POLICY "Users can delete their own devices" ON trusted_devices IS 
'Users can remove/revoke devices from their account.';

