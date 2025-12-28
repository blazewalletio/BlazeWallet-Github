-- Migration: Drop portfolio_snapshots table and related objects
-- Date: 2025-01-22
-- Reason: Portfolio chart feature removed, table no longer needed

-- Drop the cleanup function if it exists
DROP FUNCTION IF EXISTS cleanup_old_portfolio_snapshots() CASCADE;

-- Drop indexes if they exist
DROP INDEX IF EXISTS idx_portfolio_snapshots_user_chain;
DROP INDEX IF EXISTS idx_portfolio_snapshots_user_address;
DROP INDEX IF EXISTS idx_portfolio_snapshots_snapshot_at;
DROP INDEX IF EXISTS idx_portfolio_snapshots_user_chain_address;

-- Drop the table (CASCADE will also drop any dependent objects like triggers, etc.)
DROP TABLE IF EXISTS public.portfolio_snapshots CASCADE;

-- Verify table is dropped (this will error if table still exists, which is fine)
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'portfolio_snapshots'
  ) THEN
    RAISE EXCEPTION 'Table portfolio_snapshots still exists after DROP';
  END IF;
END $$;

