-- ============================================================================
-- GET RECENT LOGS - Last 30 minutes
-- Run this in Supabase SQL Editor to see what's happening
-- ============================================================================

-- 1. Get all debug logs from last 30 minutes
SELECT 
  id,
  created_at,
  level,
  category,
  message,
  data,
  device_info,
  user_id,
  session_id,
  url,
  user_agent
FROM debug_logs
WHERE created_at >= NOW() - INTERVAL '30 minutes'
ORDER BY created_at DESC
LIMIT 500;

-- ============================================================================
-- 2. Get device verification specific logs
-- ============================================================================
SELECT 
  id,
  created_at,
  level,
  category,
  message,
  data->>'deviceId' as device_id,
  data->>'verificationCode' as verification_code,
  data->>'error' as error_message,
  data,
  user_id
FROM debug_logs
WHERE created_at >= NOW() - INTERVAL '30 minutes'
  AND (
    message ILIKE '%device%' 
    OR message ILIKE '%verification%'
    OR message ILIKE '%SignIn%'
    OR category = 'device_verification'
    OR category = 'auth'
  )
ORDER BY created_at DESC
LIMIT 100;

-- ============================================================================
-- 3. Check trusted_devices table - recent attempts
-- ============================================================================
SELECT 
  id,
  user_id,
  device_id,
  device_name,
  verification_code,
  verification_expires_at,
  verified_at,
  created_at,
  last_used_at,
  is_current
FROM trusted_devices
WHERE created_at >= NOW() - INTERVAL '30 minutes'
   OR last_used_at >= NOW() - INTERVAL '30 minutes'
ORDER BY created_at DESC
LIMIT 50;

-- ============================================================================
-- 4. Check for RLS policy violations (PostgreSQL logs)
-- ============================================================================
-- Note: This might not be available depending on your Supabase plan
-- But we can check if any devices were created/updated recently
SELECT 
  schemaname,
  tablename,
  policyname as policy_name,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'trusted_devices';

-- ============================================================================
-- 5. Get current session info for debugging
-- ============================================================================
SELECT 
  auth.uid() as current_user_id,
  auth.role() as current_role,
  current_setting('request.jwt.claims', true)::json as jwt_claims;

-- ============================================================================
-- 6. Count recent device creation attempts by user
-- ============================================================================
SELECT 
  user_id,
  COUNT(*) as attempt_count,
  MAX(created_at) as last_attempt,
  MAX(last_used_at) as last_used,
  COUNT(CASE WHEN verified_at IS NOT NULL THEN 1 END) as verified_count,
  COUNT(CASE WHEN verified_at IS NULL THEN 1 END) as unverified_count
FROM trusted_devices
WHERE created_at >= NOW() - INTERVAL '30 minutes'
   OR last_used_at >= NOW() - INTERVAL '30 minutes'
GROUP BY user_id;

