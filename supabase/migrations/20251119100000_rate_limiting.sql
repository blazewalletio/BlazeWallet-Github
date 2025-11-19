-- Rate Limiting for Failed Login Attempts
-- Tracks failed login attempts and implements temporary account lockout

-- Create failed_login_attempts table
CREATE TABLE IF NOT EXISTS public.failed_login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_identifier VARCHAR(255) NOT NULL, -- Email or wallet address
  attempt_count INTEGER DEFAULT 1,
  last_attempt_at TIMESTAMPTZ DEFAULT NOW(),
  locked_until TIMESTAMPTZ,
  ip_address VARCHAR(45), -- IPv4 or IPv6
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint per user
  UNIQUE(user_identifier)
);

-- Create index for faster lookups
CREATE INDEX idx_failed_login_user ON public.failed_login_attempts(user_identifier);
CREATE INDEX idx_failed_login_locked ON public.failed_login_attempts(locked_until) WHERE locked_until IS NOT NULL;

-- Enable RLS
ALTER TABLE public.failed_login_attempts ENABLE ROW LEVEL SECURITY;

-- RLS Policies (only authenticated users can view their own attempts)
CREATE POLICY "Users can view their own failed attempts"
  ON public.failed_login_attempts
  FOR SELECT
  TO authenticated
  USING (user_identifier = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Admin-level policies (for future admin panel)
CREATE POLICY "Service role can manage all attempts"
  ON public.failed_login_attempts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to record failed login attempt
CREATE OR REPLACE FUNCTION record_failed_login_attempt(
  p_user_identifier VARCHAR,
  p_ip_address VARCHAR DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_attempt_count INTEGER;
  v_locked_until TIMESTAMPTZ;
  v_max_attempts INTEGER := 5;
  v_lockout_duration INTERVAL := '15 minutes';
BEGIN
  -- Insert or update failed attempt
  INSERT INTO public.failed_login_attempts (
    user_identifier,
    attempt_count,
    last_attempt_at,
    ip_address,
    user_agent
  )
  VALUES (
    p_user_identifier,
    1,
    NOW(),
    p_ip_address,
    p_user_agent
  )
  ON CONFLICT (user_identifier)
  DO UPDATE SET
    attempt_count = CASE
      -- Reset count if locked period expired
      WHEN failed_login_attempts.locked_until IS NOT NULL 
           AND failed_login_attempts.locked_until < NOW()
      THEN 1
      -- Increment if still within attempt window (30 minutes)
      WHEN failed_login_attempts.last_attempt_at > NOW() - INTERVAL '30 minutes'
      THEN failed_login_attempts.attempt_count + 1
      -- Reset if attempts are too old
      ELSE 1
    END,
    last_attempt_at = NOW(),
    ip_address = p_ip_address,
    user_agent = p_user_agent,
    -- Lock account if max attempts reached
    locked_until = CASE
      WHEN (CASE
        WHEN failed_login_attempts.locked_until IS NOT NULL 
             AND failed_login_attempts.locked_until < NOW()
        THEN 1
        WHEN failed_login_attempts.last_attempt_at > NOW() - INTERVAL '30 minutes'
        THEN failed_login_attempts.attempt_count + 1
        ELSE 1
      END) >= v_max_attempts
      THEN NOW() + v_lockout_duration
      ELSE NULL
    END
  RETURNING attempt_count, locked_until INTO v_attempt_count, v_locked_until;

  -- Return result
  RETURN json_build_object(
    'attempt_count', v_attempt_count,
    'max_attempts', v_max_attempts,
    'locked_until', v_locked_until,
    'is_locked', v_locked_until IS NOT NULL AND v_locked_until > NOW(),
    'remaining_attempts', GREATEST(0, v_max_attempts - v_attempt_count)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is locked
CREATE OR REPLACE FUNCTION is_user_locked(p_user_identifier VARCHAR)
RETURNS JSON AS $$
DECLARE
  v_locked_until TIMESTAMPTZ;
  v_attempt_count INTEGER;
BEGIN
  SELECT locked_until, attempt_count
  INTO v_locked_until, v_attempt_count
  FROM public.failed_login_attempts
  WHERE user_identifier = p_user_identifier;

  -- No record found = not locked
  IF NOT FOUND THEN
    RETURN json_build_object(
      'is_locked', false,
      'attempt_count', 0,
      'remaining_attempts', 5
    );
  END IF;

  -- Check if lock expired
  IF v_locked_until IS NOT NULL AND v_locked_until > NOW() THEN
    RETURN json_build_object(
      'is_locked', true,
      'locked_until', v_locked_until,
      'attempt_count', v_attempt_count,
      'remaining_attempts', 0,
      'unlock_in_seconds', EXTRACT(EPOCH FROM (v_locked_until - NOW()))::INTEGER
    );
  END IF;

  -- Not locked
  RETURN json_build_object(
    'is_locked', false,
    'attempt_count', v_attempt_count,
    'remaining_attempts', GREATEST(0, 5 - v_attempt_count)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clear failed attempts (on successful login)
CREATE OR REPLACE FUNCTION clear_failed_login_attempts(p_user_identifier VARCHAR)
RETURNS VOID AS $$
BEGIN
  DELETE FROM public.failed_login_attempts
  WHERE user_identifier = p_user_identifier;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION record_failed_login_attempt TO anon, authenticated;
GRANT EXECUTE ON FUNCTION is_user_locked TO anon, authenticated;
GRANT EXECUTE ON FUNCTION clear_failed_login_attempts TO authenticated;

-- Cleanup job: Remove old attempts (older than 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_failed_attempts()
RETURNS VOID AS $$
BEGIN
  DELETE FROM public.failed_login_attempts
  WHERE last_attempt_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE public.failed_login_attempts IS 'Tracks failed login attempts for rate limiting and security';
COMMENT ON FUNCTION record_failed_login_attempt IS 'Records a failed login attempt and locks account after 5 attempts';
COMMENT ON FUNCTION is_user_locked IS 'Checks if a user account is currently locked due to failed attempts';
COMMENT ON FUNCTION clear_failed_login_attempts IS 'Clears failed attempts on successful login';

