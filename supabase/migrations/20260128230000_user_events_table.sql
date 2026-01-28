-- =============================================================================
-- USER EVENTS TABLE - For Client-Side Analytics Tracking
-- =============================================================================
-- This table stores all user events tracked via the trackEvent() function
-- Used for onramp purchases, feature usage, and other client-side events

CREATE TABLE IF NOT EXISTS public.user_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Event Information
  event_name TEXT NOT NULL, -- e.g., 'onramp_purchase_initiated', 'feature_swap'
  event_data JSONB DEFAULT '{}'::jsonb, -- Flexible data storage
  
  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_events_user_id ON public.user_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_events_name ON public.user_events(event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_events_created_at ON public.user_events(created_at DESC);

-- Enable RLS
ALTER TABLE public.user_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can insert their own events
CREATE POLICY "Users can insert their own events"
  ON public.user_events
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can read their own events
CREATE POLICY "Users can read their own events"
  ON public.user_events
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Service role can read all events (for admin dashboard)
CREATE POLICY "Service role can read all events"
  ON public.user_events
  FOR SELECT
  TO service_role
  USING (true);

-- Comments
COMMENT ON TABLE public.user_events IS 'Client-side user events for analytics tracking';
COMMENT ON COLUMN public.user_events.event_name IS 'Event name (e.g., onramp_purchase_initiated)';
COMMENT ON COLUMN public.user_events.event_data IS 'Flexible JSONB data for event properties';


-- =============================================================================
-- TRACK USER EVENT RPC FUNCTION
-- =============================================================================

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
  -- Insert into user_events table
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

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.track_user_event(UUID, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.track_user_event(UUID, TEXT, JSONB) TO anon;

COMMENT ON FUNCTION public.track_user_event IS 'Track user events for analytics (called from client-side trackEvent())';

