-- ============================================================================
-- 🔥 BLAZE WALLET - GAS PRICE COLLECTION SCHEDULER
-- ============================================================================
-- Sets up pg_cron to automatically collect gas prices every 15 minutes
-- ============================================================================

-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove existing job if it exists
SELECT cron.unschedule('collect-gas-prices-job');

-- Schedule gas price collection every 15 minutes
-- This will call the Supabase Edge Function automatically
SELECT cron.schedule(
  'collect-gas-prices-job',
  '*/15 * * * *', -- Every 15 minutes
  $$
  SELECT
    net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/collect-gas-prices',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.supabase_anon_key')
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);

-- Store Supabase URL and keys as settings (you'll need to set these)
-- Run these manually with your actual values:
-- 
-- ALTER DATABASE postgres SET app.settings.supabase_url = 'https://ldehmephukevxumwdbwt.supabase.co';
-- ALTER DATABASE postgres SET app.settings.supabase_anon_key = 'your-anon-key-here';

-- View scheduled jobs
SELECT * FROM cron.job WHERE jobname = 'collect-gas-prices-job';

-- View job execution history (last 10 runs)
SELECT 
  jobid,
  runid,
  job_pid,
  database,
  username,
  command,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'collect-gas-prices-job')
ORDER BY start_time DESC
LIMIT 10;

