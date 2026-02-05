-- ============================================================================
-- 🧹 CLEAN START: Delete ALL trusted devices from database
-- ============================================================================
-- 
-- PURPOSE:
--   Remove all existing trusted devices so all users (including team)
--   can start fresh with the new "Trust Anchor" device verification system
--
-- WHAT THIS DOES:
--   ✅ Deletes ALL records from trusted_devices table
--   ✅ Resets device verification for ALL users
--   ✅ Users will need to verify their devices again on next login
--   ✅ Does NOT delete user accounts, wallets, or other data
--
-- SAFETY:
--   ⚠️  This is IRREVERSIBLE - all device trust will be lost
--   ✅ Users can re-verify devices on next login (no data loss)
--   ✅ Only affects device trust, not authentication
--
-- RUN THIS IN: Supabase SQL Editor
-- ============================================================================

-- Step 1: Show current device count (for confirmation)
SELECT 
  COUNT(*) as total_devices,
  COUNT(DISTINCT user_id) as users_with_devices
FROM trusted_devices;

-- Step 2: Delete all trusted devices
DELETE FROM trusted_devices;

-- Step 3: Verify deletion (should return 0)
SELECT 
  COUNT(*) as remaining_devices
FROM trusted_devices;

-- ============================================================================
-- ✅ DONE!
-- ============================================================================
-- All trusted devices have been deleted.
-- Users will verify their devices again on next login with the new system.
-- ============================================================================

