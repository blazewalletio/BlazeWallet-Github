-- =============================================================================
-- PORTFOLIO SNAPSHOTS TABLE
-- =============================================================================
-- Stores portfolio balance snapshots for multi-device sync
-- Like Bitvavo: server-side storage for accurate charts across all devices

CREATE TABLE IF NOT EXISTS public.portfolio_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Snapshot data
  balance_usd DECIMAL(18, 2) NOT NULL,
  address TEXT NOT NULL,
  chain TEXT NOT NULL,
  
  -- Timestamp
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Metadata (optional, for analytics)
  token_count INTEGER DEFAULT 0,
  native_balance TEXT,
  
  -- Prevent duplicate snapshots at same time
  CONSTRAINT unique_user_address_chain_time UNIQUE (user_id, address, chain, snapshot_at)
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_user_id ON public.portfolio_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_address_chain ON public.portfolio_snapshots(address, chain);
CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_snapshot_at ON public.portfolio_snapshots(snapshot_at DESC);
CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_user_chain_time ON public.portfolio_snapshots(user_id, chain, snapshot_at DESC);

-- RLS (Row Level Security)
ALTER TABLE public.portfolio_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own snapshots"
  ON public.portfolio_snapshots FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own snapshots"
  ON public.portfolio_snapshots FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own snapshots"
  ON public.portfolio_snapshots FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own snapshots"
  ON public.portfolio_snapshots FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Auto-cleanup function: Delete snapshots older than 1 year
CREATE OR REPLACE FUNCTION cleanup_old_portfolio_snapshots()
RETURNS void AS $$
BEGIN
  DELETE FROM public.portfolio_snapshots
  WHERE snapshot_at < NOW() - INTERVAL '1 year';
  
  -- Log cleanup (optional)
  RAISE NOTICE 'Cleaned up old portfolio snapshots';
END;
$$ LANGUAGE plpgsql;

-- Schedule daily cleanup at 2 AM (if pg_cron is enabled)
-- Note: This requires pg_cron extension to be enabled
-- SELECT cron.schedule(
--   'cleanup-portfolio-snapshots',
--   '0 2 * * *',
--   $$SELECT cleanup_old_portfolio_snapshots()$$
-- );

COMMENT ON TABLE public.portfolio_snapshots IS 'Stores portfolio balance snapshots for multi-device sync and accurate chart rendering';
COMMENT ON COLUMN public.portfolio_snapshots.balance_usd IS 'Total portfolio value in USD at snapshot time';
COMMENT ON COLUMN public.portfolio_snapshots.snapshot_at IS 'Timestamp when snapshot was taken';

