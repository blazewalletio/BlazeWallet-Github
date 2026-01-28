-- =============================================================================
-- 📊 USER ANALYTICS SYSTEM - HYBRID REAL-TIME MONITORING
-- =============================================================================
-- Migration Date: 2026-01-28
-- Purpose: Enable comprehensive user activity monitoring for growth insights
-- 
-- Key Features:
-- - Real-time transaction event logging
-- - User cohort analysis for retention/churn
-- - Feature usage tracking
-- - Automated anomaly detection & alerts
-- - GDPR-compliant with privacy-first design
-- 
-- Impact: ZERO impact on existing functionality (additive only)
-- =============================================================================

-- =============================================================================
-- TABLE 1: TRANSACTION EVENTS (Append-Only Event Log)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.transaction_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Event Type (detailed lifecycle tracking)
  event_type TEXT NOT NULL CHECK (event_type IN (
    'send_initiated', 
    'send_confirmed', 
    'send_failed',
    'receive_detected',
    'swap_initiated', 
    'swap_confirmed', 
    'swap_failed',
    'onramp_initiated', 
    'onramp_completed',
    'onramp_failed'
  )),
  
  -- Context (minimal metadata for privacy)
  chain_key TEXT NOT NULL,
  token_symbol TEXT,
  
  -- Value (USD only for analytics - no exact amounts)
  value_usd DECIMAL(20, 2),
  
  -- Status
  status TEXT CHECK (status IN ('pending', 'success', 'failed')),
  
  -- Reference (hashed for privacy - never store actual tx hash)
  reference_id TEXT, -- SHA-256 hash of tx hash or order ID
  
  -- Metadata (flexible JSONB for future extensibility)
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tx_events_user_time ON public.transaction_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tx_events_type ON public.transaction_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tx_events_chain ON public.transaction_events(chain_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tx_events_status ON public.transaction_events(status, created_at DESC);

-- Comments for documentation
COMMENT ON TABLE public.transaction_events IS 'Append-only log of all user transaction events for analytics. Privacy-first: only USD values and hashed references.';
COMMENT ON COLUMN public.transaction_events.event_type IS 'Lifecycle event type (initiated, confirmed, failed)';
COMMENT ON COLUMN public.transaction_events.reference_id IS 'SHA-256 hash of tx hash or order ID (never actual value)';
COMMENT ON COLUMN public.transaction_events.value_usd IS 'Transaction value in USD for analytics only';


-- =============================================================================
-- TABLE 2: USER COHORTS (User Segmentation & Lifecycle)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.user_cohorts (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- User Classification
  cohort_month TEXT NOT NULL, -- '2026-01' format (signup month)
  user_segment TEXT CHECK (user_segment IN ('new', 'active', 'power_user', 'dormant', 'churned')),
  
  -- Lifecycle Metrics
  signup_date DATE NOT NULL,
  first_transaction_date DATE,
  last_transaction_date DATE,
  days_to_first_transaction INTEGER,
  
  -- Activity Counts (Lifetime)
  total_transactions INTEGER DEFAULT 0,
  total_swaps INTEGER DEFAULT 0,
  total_onramps INTEGER DEFAULT 0,
  
  -- Volume (Lifetime, USD)
  total_volume_usd DECIMAL(20, 2) DEFAULT 0,
  
  -- Engagement Score (0-100, calculated by function)
  engagement_score INTEGER DEFAULT 0 CHECK (engagement_score >= 0 AND engagement_score <= 100),
  
  -- Preferences (detected from usage patterns)
  preferred_chain TEXT,
  favorite_tokens JSONB DEFAULT '[]'::jsonb,
  
  -- Metadata
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_cohorts_month ON public.user_cohorts(cohort_month);
CREATE INDEX IF NOT EXISTS idx_cohorts_segment ON public.user_cohorts(user_segment, engagement_score DESC);
CREATE INDEX IF NOT EXISTS idx_cohorts_last_tx ON public.user_cohorts(last_transaction_date DESC NULLS LAST);

-- Comments
COMMENT ON TABLE public.user_cohorts IS 'User segmentation and lifecycle tracking for growth analytics';
COMMENT ON COLUMN public.user_cohorts.cohort_month IS 'Month user signed up (YYYY-MM format) for cohort analysis';
COMMENT ON COLUMN public.user_cohorts.user_segment IS 'Current user segment: new, active, power_user, dormant, or churned';
COMMENT ON COLUMN public.user_cohorts.engagement_score IS 'Calculated engagement score (0-100) based on activity';


-- =============================================================================
-- TABLE 3: FEATURE USAGE STATS (What features are users using?)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.feature_usage_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  feature_name TEXT NOT NULL,
  
  -- Usage Counts
  total_uses INTEGER DEFAULT 0,
  unique_users INTEGER DEFAULT 0,
  
  -- Performance Metrics
  avg_completion_rate DECIMAL(5, 2), -- % of users who complete the feature flow
  avg_time_to_complete_seconds INTEGER,
  
  -- Metadata (flexible for feature-specific data)
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamp
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one record per date per feature
  UNIQUE(date, feature_name)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_feature_stats_date ON public.feature_usage_stats(date DESC, feature_name);
CREATE INDEX IF NOT EXISTS idx_feature_stats_name ON public.feature_usage_stats(feature_name, date DESC);

-- Comments
COMMENT ON TABLE public.feature_usage_stats IS 'Aggregated daily statistics on feature usage across all users';
COMMENT ON COLUMN public.feature_usage_stats.feature_name IS 'Feature identifier (e.g., swap_modal_opened, buy_crypto_clicked)';


-- =============================================================================
-- TABLE 4: REALTIME METRICS (Hot Data, Auto-Expire after 24h)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.realtime_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_key TEXT NOT NULL,
  metric_value DECIMAL(20, 2) NOT NULL,
  metric_label TEXT, -- Optional human-readable label
  
  -- TTL (auto-delete after 24 hours)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_realtime_metrics_key ON public.realtime_metrics(metric_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_realtime_metrics_expire ON public.realtime_metrics(expires_at);

-- Comments
COMMENT ON TABLE public.realtime_metrics IS 'Short-lived metrics cache for real-time dashboard (24h TTL)';
COMMENT ON COLUMN public.realtime_metrics.expires_at IS 'Auto-expire timestamp - cleaned up by cron job';


-- =============================================================================
-- TABLE 5: ADMIN ALERTS (Automated Monitoring & Notifications)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.admin_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Alert Type & Severity
  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'high_volume_user',
    'suspicious_pattern',
    'failed_transactions_spike',
    'new_user_spike',
    'volume_drop',
    'error_rate_high',
    'system_health',
    'growth_milestone'
  )),
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  
  -- Alert Content
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  
  -- Context (optional)
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- NULL if system-wide alert
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Status Tracking
  status TEXT DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'resolved', 'dismissed')),
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT, -- Admin email who resolved it
  resolution_note TEXT,
  
  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_alerts_status ON public.admin_alerts(status, severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_type ON public.admin_alerts(alert_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_user ON public.admin_alerts(user_id) WHERE user_id IS NOT NULL;

-- Comments
COMMENT ON TABLE public.admin_alerts IS 'Automated alerts and notifications for admin monitoring';
COMMENT ON COLUMN public.admin_alerts.severity IS 'Alert severity: info (FYI), warning (check soon), critical (urgent)';
COMMENT ON COLUMN public.admin_alerts.status IS 'Alert status: unread, read, resolved, or dismissed';


-- =============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE public.transaction_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_usage_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.realtime_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_alerts ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- TRANSACTION EVENTS POLICIES
-- -----------------------------------------------------------------------------

-- Users can view their own transaction events
CREATE POLICY "Users can view own transaction events"
  ON public.transaction_events FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Service role can do everything (for backend logging)
CREATE POLICY "Service role full access transaction events"
  ON public.transaction_events FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- USER COHORTS POLICIES
-- -----------------------------------------------------------------------------

-- Users can view their own cohort data
CREATE POLICY "Users can view own cohort data"
  ON public.user_cohorts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Service role full access (for aggregations)
CREATE POLICY "Service role full access user cohorts"
  ON public.user_cohorts FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- FEATURE USAGE STATS POLICIES (Public aggregated data, no personal info)
-- -----------------------------------------------------------------------------

-- Authenticated users can view feature stats (no personal data, safe to expose)
CREATE POLICY "Authenticated users can view feature stats"
  ON public.feature_usage_stats FOR SELECT
  TO authenticated
  USING (true);

-- Service role full access
CREATE POLICY "Service role full access feature stats"
  ON public.feature_usage_stats FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- REALTIME METRICS POLICIES (Public aggregated data)
-- -----------------------------------------------------------------------------

-- Authenticated users can view realtime metrics (no personal data)
CREATE POLICY "Authenticated users can view realtime metrics"
  ON public.realtime_metrics FOR SELECT
  TO authenticated
  USING (true);

-- Service role full access
CREATE POLICY "Service role full access realtime metrics"
  ON public.realtime_metrics FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- ADMIN ALERTS POLICIES (Service role only)
-- -----------------------------------------------------------------------------

-- Only service role can access alerts (sensitive admin data)
CREATE POLICY "Service role full access admin alerts"
  ON public.admin_alerts FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- FUNCTION: cleanup_expired_realtime_metrics
-- Purpose: Auto-delete metrics older than 24 hours
-- Called by: Cron job (daily)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cleanup_expired_realtime_metrics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.realtime_metrics 
  WHERE expires_at < NOW();
END;
$$;

COMMENT ON FUNCTION public.cleanup_expired_realtime_metrics IS 'Cleanup function: removes expired realtime metrics (24h TTL)';

-- -----------------------------------------------------------------------------
-- FUNCTION: increment_feature_usage
-- Purpose: Atomically increment feature usage counters
-- Called by: /api/analytics/batch-log endpoint
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.increment_feature_usage(
  p_date DATE,
  p_feature_name TEXT,
  p_user_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Insert or update feature usage stats
  INSERT INTO public.feature_usage_stats (date, feature_name, total_uses, unique_users)
  VALUES (p_date, p_feature_name, 1, 1)
  ON CONFLICT (date, feature_name) 
  DO UPDATE SET
    total_uses = public.feature_usage_stats.total_uses + 1,
    updated_at = NOW();
    
  -- Note: unique_users tracking would require a separate tracking table
  -- For now, we increment total_uses only (simplified)
END;
$$;

COMMENT ON FUNCTION public.increment_feature_usage IS 'Atomically increment feature usage counters for daily stats';

-- -----------------------------------------------------------------------------
-- FUNCTION: update_user_cohort_from_event
-- Purpose: Update user cohort stats when transaction event is logged
-- Called by: Trigger on transaction_events INSERT
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_user_cohort_from_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Only process confirmed events
  IF NEW.status != 'success' THEN
    RETURN NEW;
  END IF;

  -- Update user cohort stats
  INSERT INTO public.user_cohorts (
    user_id,
    cohort_month,
    signup_date,
    first_transaction_date,
    last_transaction_date,
    total_transactions,
    total_swaps,
    total_onramps,
    total_volume_usd
  )
  SELECT
    NEW.user_id,
    TO_CHAR((SELECT created_at FROM auth.users WHERE id = NEW.user_id), 'YYYY-MM'),
    (SELECT created_at::DATE FROM auth.users WHERE id = NEW.user_id),
    CURRENT_DATE,
    CURRENT_DATE,
    CASE WHEN NEW.event_type IN ('send_confirmed', 'receive_detected') THEN 1 ELSE 0 END,
    CASE WHEN NEW.event_type = 'swap_confirmed' THEN 1 ELSE 0 END,
    CASE WHEN NEW.event_type = 'onramp_completed' THEN 1 ELSE 0 END,
    COALESCE(NEW.value_usd, 0)
  ON CONFLICT (user_id)
  DO UPDATE SET
    last_transaction_date = CURRENT_DATE,
    first_transaction_date = COALESCE(public.user_cohorts.first_transaction_date, CURRENT_DATE),
    total_transactions = public.user_cohorts.total_transactions + 
      CASE WHEN NEW.event_type IN ('send_confirmed', 'receive_detected') THEN 1 ELSE 0 END,
    total_swaps = public.user_cohorts.total_swaps + 
      CASE WHEN NEW.event_type = 'swap_confirmed' THEN 1 ELSE 0 END,
    total_onramps = public.user_cohorts.total_onramps + 
      CASE WHEN NEW.event_type = 'onramp_completed' THEN 1 ELSE 0 END,
    total_volume_usd = public.user_cohorts.total_volume_usd + COALESCE(NEW.value_usd, 0),
    updated_at = NOW();

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.update_user_cohort_from_event IS 'Trigger function: updates user cohort stats when transaction event is logged';

-- Create trigger
DROP TRIGGER IF EXISTS update_user_cohort_on_event ON public.transaction_events;
CREATE TRIGGER update_user_cohort_on_event
  AFTER INSERT ON public.transaction_events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_cohort_from_event();


-- =============================================================================
-- GRANTS (Permissions)
-- =============================================================================

-- Grant necessary permissions to authenticated users
GRANT SELECT ON public.transaction_events TO authenticated;
GRANT SELECT ON public.user_cohorts TO authenticated;
GRANT SELECT ON public.feature_usage_stats TO authenticated;
GRANT SELECT ON public.realtime_metrics TO authenticated;

-- Service role has full access (already enforced by RLS policies)


-- =============================================================================
-- DATA INITIALIZATION
-- =============================================================================

-- Initialize cohorts for existing users (backfill)
INSERT INTO public.user_cohorts (
  user_id,
  cohort_month,
  signup_date,
  total_transactions,
  total_swaps,
  total_onramps,
  total_volume_usd,
  user_segment
)
SELECT 
  u.id as user_id,
  TO_CHAR(u.created_at, 'YYYY-MM') as cohort_month,
  u.created_at::DATE as signup_date,
  0 as total_transactions,
  0 as total_swaps,
  0 as total_onramps,
  0 as total_volume_usd,
  'new' as user_segment
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_cohorts c WHERE c.user_id = u.id
);


-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================

-- Log success
DO $$
BEGIN
  RAISE NOTICE '✅ User Analytics System migration completed successfully!';
  RAISE NOTICE '📊 Created tables: transaction_events, user_cohorts, feature_usage_stats, realtime_metrics, admin_alerts';
  RAISE NOTICE '🔒 RLS enabled on all tables with appropriate policies';
  RAISE NOTICE '⚙️ Helper functions and triggers created';
  RAISE NOTICE '👥 Existing users initialized in cohorts table';
END $$;

