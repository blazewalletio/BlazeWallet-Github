-- ============================================================================
-- TRUSTED DEVICES OVERVIEW - All devices per user
-- Shows which devices are trusted/verified for each account
-- ============================================================================

-- 1. FULL OVERVIEW: All trusted devices with details
SELECT 
  td.id,
  td.user_id,
  up.username,
  up.email,
  td.device_id,
  td.device_name,
  td.browser,
  td.os,
  td.ip_address,
  td.verified_at,
  td.created_at,
  td.last_used_at,
  td.is_current,
  CASE 
    WHEN td.verified_at IS NOT NULL THEN '✅ VERIFIED'
    ELSE '⏳ PENDING'
  END as verification_status,
  CASE 
    WHEN td.last_used_at >= NOW() - INTERVAL '7 days' THEN '🟢 Active'
    WHEN td.last_used_at >= NOW() - INTERVAL '30 days' THEN '🟡 Recent'
    ELSE '🔴 Inactive'
  END as activity_status
FROM trusted_devices td
LEFT JOIN user_profiles up ON td.user_id = up.user_id
ORDER BY td.user_id, td.verified_at DESC NULLS LAST, td.created_at DESC;

-- ============================================================================
-- 2. SUMMARY: Count of devices per user
-- ============================================================================
SELECT 
  td.user_id,
  up.username,
  up.email,
  COUNT(*) as total_devices,
  COUNT(CASE WHEN td.verified_at IS NOT NULL THEN 1 END) as verified_devices,
  COUNT(CASE WHEN td.verified_at IS NULL THEN 1 END) as pending_devices,
  COUNT(CASE WHEN td.last_used_at >= NOW() - INTERVAL '7 days' THEN 1 END) as active_devices,
  MAX(td.last_used_at) as last_activity
FROM trusted_devices td
LEFT JOIN user_profiles up ON td.user_id = up.user_id
GROUP BY td.user_id, up.username, up.email
ORDER BY last_activity DESC NULLS LAST;

-- ============================================================================
-- 3. VERIFIED DEVICES ONLY - Only show trusted/verified devices
-- ============================================================================
SELECT 
  td.user_id,
  up.username,
  up.email,
  td.device_name,
  td.browser,
  td.os,
  td.verified_at,
  td.last_used_at,
  td.is_current,
  EXTRACT(DAY FROM NOW() - td.verified_at) as days_since_verified,
  EXTRACT(DAY FROM NOW() - td.last_used_at) as days_since_last_use
FROM trusted_devices td
LEFT JOIN user_profiles up ON td.user_id = up.user_id
WHERE td.verified_at IS NOT NULL
ORDER BY td.last_used_at DESC NULLS LAST;

-- ============================================================================
-- 4. PENDING VERIFICATION - Devices waiting for verification
-- ============================================================================
SELECT 
  td.id,
  td.user_id,
  up.email,
  td.device_name,
  td.verification_code,
  td.verification_expires_at,
  td.created_at,
  CASE 
    WHEN td.verification_expires_at < NOW() THEN '❌ EXPIRED'
    ELSE '✅ VALID'
  END as code_status,
  EXTRACT(MINUTE FROM td.verification_expires_at - NOW()) as minutes_until_expiry
FROM trusted_devices td
LEFT JOIN user_profiles up ON td.user_id = up.user_id
WHERE td.verified_at IS NULL
ORDER BY td.created_at DESC;

-- ============================================================================
-- 5. YOUR ACCOUNT ONLY - Replace with your user_id
-- ============================================================================
-- Uncomment and replace 'YOUR_USER_ID_HERE' with your actual user_id
/*
SELECT 
  td.device_name,
  td.browser,
  td.os,
  td.device_id,
  td.verified_at,
  td.created_at,
  td.last_used_at,
  td.is_current,
  CASE 
    WHEN td.verified_at IS NOT NULL THEN '✅ VERIFIED'
    ELSE '⏳ PENDING'
  END as status
FROM trusted_devices td
WHERE td.user_id = 'YOUR_USER_ID_HERE'
ORDER BY td.is_current DESC, td.last_used_at DESC;
*/

