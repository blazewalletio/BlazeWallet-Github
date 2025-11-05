-- ============================================================================
-- 🔥 BLAZE WALLET - ACTIVATE GAS COLLECTION SCHEDULER
-- ============================================================================
-- Run this SQL in Supabase SQL Editor to enable automatic gas collection
-- ============================================================================

-- 1. Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Remove existing job if it exists (for re-running)
DO $$
BEGIN
  PERFORM cron.unschedule('collect-gas-prices-job');
EXCEPTION
  WHEN OTHERS THEN NULL;
END
$$;

-- 3. Schedule gas price collection every 15 minutes
SELECT cron.schedule(
  'collect-gas-prices-job',
  '*/15 * * * *', -- Every 15 minutes
  $$
  SELECT
    net.http_post(
      url := 'https://ldehmephukevxumwdbwt.supabase.co/functions/v1/collect-gas-prices',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN3Ym9jZmdiaHdidWdoZHBzd2RrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mjk0NTM1NjgsImV4cCI6MjA0NTAyOTU2OH0.oMKl4TQqN_VE5Lc7YI7VNzFXsGBH4Yh5RK5Z5Hm0Qz4'
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);

-- 4. Verify the job is scheduled
SELECT 
  jobid,
  jobname,
  schedule,
  command,
  active
FROM cron.job 
WHERE jobname = 'collect-gas-prices-job';

-- 5. Test the function immediately (optional)
SELECT
  net.http_post(
    url := 'https://ldehmephukevxumwdbwt.supabase.co/functions/v1/collect-gas-prices',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN3Ym9jZmdiaHdidWdoZHBzd2RrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mjk0NTM1NjgsImV4cCI6MjA0NTAyOTU2OH0.oMKl4TQqN_VE5Lc7YI7VNzFXsGBH4Yh5RK5Z5Hm0Qz4'
    ),
    body := '{}'::jsonb
  ) as request_id;

-- 6. Check job execution history (run this after 15 minutes)
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

