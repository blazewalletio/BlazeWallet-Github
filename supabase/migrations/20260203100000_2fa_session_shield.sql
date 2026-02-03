-- ============================================================================
-- BLAZE WALLET - 2FA SESSION SHIELD
-- ============================================================================
-- Purpose: Time-based 2FA sessions for "SESSION SHIELD" implementation
-- Strategy: 2FA at login, then 30-min secure session for most actions
-- Author: BLAZE Team
-- Date: 2026-02-03
-- ============================================================================

-- ============================================================================
-- TABLE: user_2fa_sessions
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_2fa_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Session Info
  session_token UUID NOT NULL DEFAULT gen_random_uuid(), -- Unique session ID
  device_fingerprint TEXT, -- Optional: tie to specific device
  
  -- 2FA Verification
  verified_2fa_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- When 2FA was last verified
  expires_at TIMESTAMPTZ NOT NULL, -- Session expiry (30 min after verification)
  
  -- Session Status
  is_active BOOLEAN DEFAULT TRUE, -- Can be revoked manually
  last_activity_at TIMESTAMPTZ DEFAULT NOW(), -- Last time session was used
  
  -- Metadata
  ip_address TEXT, -- IP at time of 2FA verification
  user_agent TEXT, -- Browser/device info
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(user_id, session_token) -- One token per user
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX idx_2fa_sessions_user_id ON user_2fa_sessions(user_id);
CREATE INDEX idx_2fa_sessions_token ON user_2fa_sessions(session_token);
CREATE INDEX idx_2fa_sessions_expires_at ON user_2fa_sessions(expires_at);
CREATE INDEX idx_2fa_sessions_active ON user_2fa_sessions(is_active) WHERE is_active = true;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================
ALTER TABLE user_2fa_sessions ENABLE ROW LEVEL SECURITY;

-- Users can only see their own sessions
CREATE POLICY "Users can view own 2FA sessions"
  ON user_2fa_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own sessions (via function only)
CREATE POLICY "Users can create own 2FA sessions"
  ON user_2fa_sessions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own sessions
CREATE POLICY "Users can update own 2FA sessions"
  ON user_2fa_sessions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own sessions
CREATE POLICY "Users can delete own 2FA sessions"
  ON user_2fa_sessions
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to create a new 2FA session (30 min validity)
CREATE OR REPLACE FUNCTION create_2fa_session(
  p_user_id UUID,
  p_device_fingerprint TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_session_token UUID;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- Session expires 30 minutes from now
  v_expires_at := NOW() + INTERVAL '30 minutes';
  
  -- Invalidate any existing active sessions for this user
  UPDATE user_2fa_sessions
  SET is_active = FALSE
  WHERE user_id = p_user_id AND is_active = TRUE;
  
  -- Create new session
  INSERT INTO user_2fa_sessions (
    user_id,
    device_fingerprint,
    expires_at,
    ip_address,
    user_agent
  )
  VALUES (
    p_user_id,
    p_device_fingerprint,
    v_expires_at,
    p_ip_address,
    p_user_agent
  )
  RETURNING session_token INTO v_session_token;
  
  RETURN v_session_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has valid 2FA session
CREATE OR REPLACE FUNCTION check_2fa_session(
  p_user_id UUID,
  p_session_token UUID DEFAULT NULL
)
RETURNS TABLE (
  is_valid BOOLEAN,
  expires_at TIMESTAMPTZ,
  seconds_remaining INTEGER
) AS $$
DECLARE
  v_session RECORD;
BEGIN
  -- Find active session
  SELECT * INTO v_session
  FROM user_2fa_sessions
  WHERE user_id = p_user_id
    AND (p_session_token IS NULL OR session_token = p_session_token)
    AND is_active = TRUE
    AND expires_at > NOW()
  ORDER BY verified_2fa_at DESC
  LIMIT 1;
  
  IF v_session IS NULL THEN
    -- No valid session found
    RETURN QUERY SELECT FALSE, NULL::TIMESTAMPTZ, 0;
  ELSE
    -- Valid session found - update last activity
    UPDATE user_2fa_sessions
    SET last_activity_at = NOW()
    WHERE id = v_session.id;
    
    -- Return session info
    RETURN QUERY SELECT 
      TRUE,
      v_session.expires_at,
      EXTRACT(EPOCH FROM (v_session.expires_at - NOW()))::INTEGER;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to extend existing 2FA session (add 30 more minutes)
CREATE OR REPLACE FUNCTION extend_2fa_session(
  p_user_id UUID,
  p_session_token UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  -- Extend session by 30 minutes
  UPDATE user_2fa_sessions
  SET 
    expires_at = NOW() + INTERVAL '30 minutes',
    verified_2fa_at = NOW(),
    last_activity_at = NOW()
  WHERE user_id = p_user_id
    AND session_token = p_session_token
    AND is_active = TRUE
    AND expires_at > NOW(); -- Only extend if not yet expired
  
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  
  RETURN v_updated > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to revoke 2FA session (logout, security)
CREATE OR REPLACE FUNCTION revoke_2fa_session(
  p_user_id UUID,
  p_session_token UUID DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  v_revoked INTEGER;
BEGIN
  IF p_session_token IS NULL THEN
    -- Revoke ALL sessions for user
    UPDATE user_2fa_sessions
    SET is_active = FALSE
    WHERE user_id = p_user_id AND is_active = TRUE;
  ELSE
    -- Revoke specific session
    UPDATE user_2fa_sessions
    SET is_active = FALSE
    WHERE user_id = p_user_id 
      AND session_token = p_session_token 
      AND is_active = TRUE;
  END IF;
  
  GET DIAGNOSTICS v_revoked = ROW_COUNT;
  
  RETURN v_revoked;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup expired sessions (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_2fa_sessions()
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  -- Delete sessions expired more than 24 hours ago
  DELETE FROM user_2fa_sessions
  WHERE expires_at < NOW() - INTERVAL '24 hours';
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_2fa_session TO authenticated;
GRANT EXECUTE ON FUNCTION check_2fa_session TO authenticated;
GRANT EXECUTE ON FUNCTION extend_2fa_session TO authenticated;
GRANT EXECUTE ON FUNCTION revoke_2fa_session TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_2fa_sessions TO authenticated;

-- ============================================================================
-- AUTO-CLEANUP TRIGGER (deactivate expired sessions)
-- ============================================================================
CREATE OR REPLACE FUNCTION auto_deactivate_expired_sessions()
RETURNS TRIGGER AS $$
BEGIN
  -- When checking sessions, auto-deactivate expired ones
  IF OLD.is_active = TRUE AND OLD.expires_at < NOW() THEN
    NEW.is_active := FALSE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_deactivate_sessions
  BEFORE UPDATE ON user_2fa_sessions
  FOR EACH ROW
  EXECUTE FUNCTION auto_deactivate_expired_sessions();

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE user_2fa_sessions IS '2FA session management for SESSION SHIELD - 30min secure sessions after 2FA verification';
COMMENT ON COLUMN user_2fa_sessions.session_token IS 'Unique session token for this 2FA verification';
COMMENT ON COLUMN user_2fa_sessions.verified_2fa_at IS 'When user last verified 2FA (for session extension)';
COMMENT ON COLUMN user_2fa_sessions.expires_at IS 'Session expires 30 minutes after last verification';
COMMENT ON COLUMN user_2fa_sessions.is_active IS 'Whether session is still active (can be revoked)';
COMMENT ON FUNCTION create_2fa_session IS 'Create new 2FA session after successful verification';
COMMENT ON FUNCTION check_2fa_session IS 'Check if user has valid active 2FA session';
COMMENT ON FUNCTION extend_2fa_session IS 'Extend existing session by 30 more minutes';
COMMENT ON FUNCTION revoke_2fa_session IS 'Revoke 2FA session(s) for security';

