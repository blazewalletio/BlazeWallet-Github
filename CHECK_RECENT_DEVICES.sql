-- Quick query to check recent device verification attempts
SELECT 
  id,
  user_id,
  device_id,
  device_name,
  verification_code,
  verification_token,
  verification_expires_at,
  created_at,
  verified_at
FROM trusted_devices
WHERE created_at >= NOW() - INTERVAL '10 minutes'
ORDER BY created_at DESC
LIMIT 10;

