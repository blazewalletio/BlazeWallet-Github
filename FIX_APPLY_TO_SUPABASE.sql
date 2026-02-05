-- ============================================================================
-- 🔧 FIX: Ambiguous "expires_at" column in check_2fa_session function
-- ============================================================================
-- 
-- ❌ CURRENT PROBLEM:
--    Error: column reference "expires_at" is ambiguous (code 42702)
--    User gets prompted for 2FA even within 30-minute grace period
--
-- 🔍 ROOT CAUSE:
--    Line 139 in original function: "AND expires_at > NOW()"
--    PostgreSQL doesn't know if this refers to:
--    1. user_2fa_sessions.expires_at (table column)
--    2. RETURN TABLE expires_at (output column)
--    3. v_session.expires_at (RECORD field)
--
-- ✅ FIX:
--    Add table alias 's' and explicitly qualify ALL column references
--    Change: "FROM user_2fa_sessions WHERE expires_at > NOW()"
--    To:     "FROM user_2fa_sessions s WHERE s.expires_at > NOW()"
--
-- 📅 Migration: 20260205000000
-- ============================================================================

-- Drop and recreate function with explicit column qualifiers
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
  -- ✅ FIX: Added table alias 's' and explicit column qualifiers
  SELECT 
    s.id,
    s.expires_at,
    s.verified_2fa_at
  INTO v_session
  FROM user_2fa_sessions s                -- Added alias 's'
  WHERE s.user_id = p_user_id             -- Qualified: s.user_id
    AND (p_session_token IS NULL OR s.session_token = p_session_token)  -- Qualified: s.session_token
    AND s.is_active = TRUE                -- Qualified: s.is_active
    AND s.expires_at > NOW()              -- ✅ NOW UNAMBIGUOUS: s.expires_at
  ORDER BY s.verified_2fa_at DESC         -- Qualified: s.verified_2fa_at
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

-- Re-grant permissions
GRANT EXECUTE ON FUNCTION check_2fa_session TO authenticated;

-- Update comment
COMMENT ON FUNCTION check_2fa_session IS 'Check if user has valid active 2FA session (FIXED: ambiguous expires_at)';

-- ============================================================================
-- ✅ VERIFICATION
-- ============================================================================
-- After running this, test with:
--   SELECT * FROM check_2fa_session('00000000-0000-0000-0000-000000000000'::UUID);
-- 
-- Expected result: No error, returns:
--   | is_valid | expires_at | seconds_remaining |
--   |----------|------------|-------------------|
--   | false    | NULL       | 0                 |
-- ============================================================================

