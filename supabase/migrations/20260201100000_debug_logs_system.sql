-- ============================================================================
-- 🔧 DEBUG LOGS SYSTEM
-- ============================================================================
-- Real-time debugging system for mobile/device verification issues
-- Logs all critical operations to Supabase for remote inspection
-- ============================================================================

-- Create debug_logs table
CREATE TABLE IF NOT EXISTS public.debug_logs (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID,
  session_id TEXT,
  level TEXT NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error')),
  category TEXT NOT NULL, -- 'device_verification', 'localStorage', 'database', 'auth', etc.
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}'::jsonb,
  device_info JSONB DEFAULT '{}'::jsonb,
  url TEXT,
  user_agent TEXT
);

-- Index for fast queries
CREATE INDEX idx_debug_logs_created_at ON public.debug_logs(created_at DESC);
CREATE INDEX idx_debug_logs_user_id ON public.debug_logs(user_id);
CREATE INDEX idx_debug_logs_session_id ON public.debug_logs(session_id);
CREATE INDEX idx_debug_logs_category ON public.debug_logs(category);
CREATE INDEX idx_debug_logs_level ON public.debug_logs(level);

-- Enable RLS
ALTER TABLE public.debug_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can insert their own logs (anon + authenticated)
CREATE POLICY "Users can insert debug logs"
ON public.debug_logs FOR INSERT
TO anon, authenticated
WITH CHECK (true); -- Allow all inserts (we need debugging from all users)

-- Policy: Users can read their own logs
CREATE POLICY "Users can read own debug logs"
ON public.debug_logs FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR user_id IS NULL);

-- Policy: Service role has full access
CREATE POLICY "Service role full access to debug logs"
ON public.debug_logs FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Auto-cleanup: Delete logs older than 7 days (keep database clean)
CREATE OR REPLACE FUNCTION cleanup_old_debug_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.debug_logs
  WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$;

-- Create a scheduled job to run cleanup daily (if pg_cron is available)
-- Note: This requires pg_cron extension, may need manual setup
-- SELECT cron.schedule('cleanup-debug-logs', '0 2 * * *', 'SELECT cleanup_old_debug_logs()');

-- Helper function: Get recent logs for a user
CREATE OR REPLACE FUNCTION get_recent_debug_logs(
  p_user_id UUID DEFAULT NULL,
  p_session_id TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_level TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50
)
RETURNS TABLE (
  id BIGINT,
  created_at TIMESTAMPTZ,
  user_id UUID,
  session_id TEXT,
  level TEXT,
  category TEXT,
  message TEXT,
  data JSONB,
  device_info JSONB,
  url TEXT,
  user_agent TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dl.id,
    dl.created_at,
    dl.user_id,
    dl.session_id,
    dl.level,
    dl.category,
    dl.message,
    dl.data,
    dl.device_info,
    dl.url,
    dl.user_agent
  FROM public.debug_logs dl
  WHERE 
    (p_user_id IS NULL OR dl.user_id = p_user_id)
    AND (p_session_id IS NULL OR dl.session_id = p_session_id)
    AND (p_category IS NULL OR dl.category = p_category)
    AND (p_level IS NULL OR dl.level = p_level)
  ORDER BY dl.created_at DESC
  LIMIT p_limit;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_recent_debug_logs TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION cleanup_old_debug_logs TO service_role;

-- Comments
COMMENT ON TABLE public.debug_logs IS 'Real-time debug logging system for mobile/device verification debugging';
COMMENT ON COLUMN public.debug_logs.level IS 'Log level: debug, info, warn, error';
COMMENT ON COLUMN public.debug_logs.category IS 'Log category: device_verification, localStorage, database, auth, etc.';
COMMENT ON COLUMN public.debug_logs.data IS 'Additional structured data (JSON)';
COMMENT ON COLUMN public.debug_logs.device_info IS 'Device information (UA, platform, screen, etc.)';

