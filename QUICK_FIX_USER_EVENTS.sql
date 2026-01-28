-- ============================================================================
-- 🚀 QUICK FIX: User Events Analytics Table + RPC Function
-- ============================================================================
-- Run this SQL in your Supabase SQL Editor to fix onramp analytics
-- Dashboard → SQL Editor → New Query → Paste this → Run
-- ============================================================================

-- Step 1: Create user_events table (if not exists)
CREATE TABLE IF NOT EXISTS public.user_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  event_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Create indexes
CREATE INDEX IF NOT EXISTS idx_user_events_user_id ON public.user_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_events_name ON public.user_events(event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_events_created_at ON public.user_events(created_at DESC);

-- Step 3: Enable RLS
ALTER TABLE public.user_events ENABLE ROW LEVEL SECURITY;

-- Step 4: Drop existing policies (if any)
DROP POLICY IF EXISTS "Users can insert their own events" ON public.user_events;
DROP POLICY IF EXISTS "Users can read their own events" ON public.user_events;
DROP POLICY IF EXISTS "Service role can read all events" ON public.user_events;

-- Step 5: Create RLS policies
CREATE POLICY "Users can insert their own events"
  ON public.user_events
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read their own events"
  ON public.user_events
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can read all events"
  ON public.user_events
  FOR SELECT
  TO service_role
  USING (true);

-- Step 6: Create RPC function
CREATE OR REPLACE FUNCTION public.track_user_event(
  p_user_id UUID,
  p_event_name TEXT,
  p_properties JSONB DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_events (
    user_id,
    event_name,
    event_data,
    created_at
  )
  VALUES (
    p_user_id,
    p_event_name,
    p_properties,
    NOW()
  );
END;
$$;

-- Step 7: Grant permissions
GRANT EXECUTE ON FUNCTION public.track_user_event(UUID, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.track_user_event(UUID, TEXT, JSONB) TO anon;

-- Step 8: Verify setup
SELECT 
  'user_events table created' AS status,
  COUNT(*) AS row_count 
FROM public.user_events;

-- ============================================================================
-- ✅ DONE! 
-- Now test by initiating an onramp purchase in the wallet
-- Then check the admin dashboard → Onramp tab
-- ============================================================================

