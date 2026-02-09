-- ============================================================================
-- FIX EXISTING MULTIPLE CURRENT DEVICES
-- ============================================================================
-- This script fixes existing data where multiple devices are marked as is_current: true
-- It sets all devices to is_current: false, then marks only the most recently used
-- device as is_current: true for each user
-- ============================================================================

-- Step 1: Set all devices to is_current: false
UPDATE trusted_devices
SET is_current = false;

-- Step 2: For each user, mark only the most recently used device as current
-- (The device with the most recent last_used_at timestamp)
WITH ranked_devices AS (
  SELECT 
    id,
    user_id,
    last_used_at,
    ROW_NUMBER() OVER (
      PARTITION BY user_id 
      ORDER BY 
        COALESCE(last_used_at, verified_at, created_at) DESC NULLS LAST
    ) as rn
  FROM trusted_devices
  WHERE verified_at IS NOT NULL -- Only verified devices can be current
)
UPDATE trusted_devices td
SET is_current = true
FROM ranked_devices rd
WHERE td.id = rd.id 
  AND rd.rn = 1; -- Only the most recent device per user

-- Verify the fix
SELECT 
  user_id,
  COUNT(*) FILTER (WHERE is_current = true) as current_count,
  COUNT(*) as total_devices
FROM trusted_devices
WHERE verified_at IS NOT NULL
GROUP BY user_id
HAVING COUNT(*) FILTER (WHERE is_current = true) > 1; -- Should return 0 rows

