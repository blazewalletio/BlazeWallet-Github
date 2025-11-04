-- AI Assistant Cache Table
-- Stores AI responses for fast retrieval and cost optimization

CREATE TABLE IF NOT EXISTS ai_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_hash TEXT NOT NULL UNIQUE,
  query TEXT NOT NULL,
  response JSONB NOT NULL,
  user_id TEXT,
  chain TEXT,
  hit_count INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours'),
  last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_cache_query_hash ON ai_cache(query_hash);
CREATE INDEX IF NOT EXISTS idx_ai_cache_expires_at ON ai_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_ai_cache_user_id ON ai_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_cache_chain ON ai_cache(chain);

-- Auto-cleanup old cache entries (run daily)
CREATE OR REPLACE FUNCTION cleanup_expired_ai_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM ai_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Enable Row Level Security
ALTER TABLE ai_cache ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read all cache (shared benefit)
CREATE POLICY "Users can read AI cache"
  ON ai_cache
  FOR SELECT
  USING (true);

-- Policy: Users can insert their own cache
CREATE POLICY "Users can insert AI cache"
  ON ai_cache
  FOR INSERT
  WITH CHECK (true);

-- Policy: Users can update hit count
CREATE POLICY "Users can update AI cache"
  ON ai_cache
  FOR UPDATE
  USING (true);

-- AI Rate Limiting Table
-- Tracks API usage per user per day

CREATE TABLE IF NOT EXISTS ai_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  query_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_ai_rate_limits_user_date ON ai_rate_limits(user_id, date);

-- Enable Row Level Security
ALTER TABLE ai_rate_limits ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own rate limits
CREATE POLICY "Users can read own rate limits"
  ON ai_rate_limits
  FOR SELECT
  USING (auth.uid()::text = user_id);

-- Policy: System can manage rate limits
CREATE POLICY "System can manage rate limits"
  ON ai_rate_limits
  FOR ALL
  USING (true);

-- Function to check and increment rate limit
CREATE OR REPLACE FUNCTION check_and_increment_rate_limit(
  p_user_id TEXT,
  p_max_queries INTEGER DEFAULT 50
)
RETURNS JSONB AS $$
DECLARE
  v_current_count INTEGER;
  v_allowed BOOLEAN;
BEGIN
  -- Get current count for today
  SELECT query_count INTO v_current_count
  FROM ai_rate_limits
  WHERE user_id = p_user_id AND date = CURRENT_DATE;
  
  -- If no record exists, create one
  IF v_current_count IS NULL THEN
    INSERT INTO ai_rate_limits (user_id, date, query_count)
    VALUES (p_user_id, CURRENT_DATE, 1)
    ON CONFLICT (user_id, date) DO UPDATE
    SET query_count = ai_rate_limits.query_count + 1,
        updated_at = NOW();
    
    RETURN jsonb_build_object(
      'allowed', true,
      'remaining', p_max_queries - 1,
      'total', p_max_queries
    );
  END IF;
  
  -- Check if under limit
  v_allowed := v_current_count < p_max_queries;
  
  -- Increment if allowed
  IF v_allowed THEN
    UPDATE ai_rate_limits
    SET query_count = query_count + 1,
        updated_at = NOW()
    WHERE user_id = p_user_id AND date = CURRENT_DATE;
  END IF;
  
  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'remaining', GREATEST(0, p_max_queries - v_current_count - 1),
    'total', p_max_queries,
    'current', v_current_count + CASE WHEN v_allowed THEN 1 ELSE 0 END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE ai_cache IS 'Caches AI assistant responses for performance and cost optimization';
COMMENT ON TABLE ai_rate_limits IS 'Tracks AI API usage per user per day (50 queries/day limit)';

