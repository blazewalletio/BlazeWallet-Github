-- ============================================================================
-- FIX: Ambiguous "expires_at" column in check_2fa_session function
-- ============================================================================
-- ERROR: column reference "expires_at" is ambiguous
-- CAUSE: Multiple tables have expires_at column, query not specific enough
-- FIX: Explicitly qualify column names with table alias
-- ============================================================================

-- Drop and recreate check_2fa_session with fixed column references
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
  -- Find active session (✅ FIX: Explicitly qualify expires_at column)
  SELECT 
    s.id,
    s.expires_at,
    s.verified_2fa_at
  INTO v_session
  FROM user_2fa_sessions s
  WHERE s.user_id = p_user_id
    AND (p_session_token IS NULL OR s.session_token = p_session_token)
    AND s.is_active = TRUE
    AND s.expires_at > NOW()  -- ✅ Now unambiguous (s.expires_at)
  ORDER BY s.verified_2fa_at DESC
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION check_2fa_session TO authenticated;

-- ============================================================================
-- COMMENT
-- ============================================================================
COMMENT ON FUNCTION check_2fa_session IS 'Check if user has valid active 2FA session (FIXED: ambiguous expires_at)';

