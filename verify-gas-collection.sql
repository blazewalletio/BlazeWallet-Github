-- ============================================================================
-- 🔍 VERIFY GAS COLLECTION IS WORKING
-- ============================================================================

-- 1. Check if pg_cron job is scheduled
SELECT 
  jobid,
  jobname,
  schedule,
  active,
  database
FROM cron.job 
WHERE jobname = 'collect-gas-prices-job';

-- 2. Check recent gas_history entries (should have data from the test run)
SELECT 
  chain,
  gas_price,
  base_fee,
  priority_fee,
  source,
  created_at
FROM gas_history
ORDER BY created_at DESC
LIMIT 50;

-- 3. Count entries per chain
SELECT 
  chain,
  COUNT(*) as total_entries,
  MIN(created_at) as oldest_entry,
  MAX(created_at) as newest_entry
FROM gas_history
GROUP BY chain
ORDER BY total_entries DESC;

-- 4. Check job execution history
SELECT 
  jobid,
  runid,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'collect-gas-prices-job')
ORDER BY start_time DESC
LIMIT 10;

