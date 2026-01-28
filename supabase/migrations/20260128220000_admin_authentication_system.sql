-- =====================================================
-- ADMIN AUTHENTICATION SYSTEM WITH 2FA
-- Version: 1.0.0
-- Date: 2026-01-28
-- =====================================================

-- Drop existing table if it exists (for clean migration)
DROP TABLE IF EXISTS public.admin_users CASCADE;
DROP TABLE IF EXISTS public.admin_sessions CASCADE;
DROP TABLE IF EXISTS public.admin_audit_log CASCADE;

-- =====================================================
-- TABLE: admin_users
-- Purpose: Store admin user credentials and 2FA secrets
-- =====================================================
CREATE TABLE public.admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    
    -- 2FA Configuration
    totp_secret TEXT, -- TOTP secret for 2FA (encrypted)
    totp_enabled BOOLEAN DEFAULT false,
    backup_codes TEXT[], -- Emergency backup codes (hashed)
    
    -- Role & Permissions
    role TEXT DEFAULT 'admin' CHECK (role IN ('super_admin', 'admin', 'analyst', 'viewer')),
    permissions JSONB DEFAULT '{"dashboard": true, "users": false, "settings": false}'::jsonb,
    
    -- Security
    is_active BOOLEAN DEFAULT true,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE,
    password_changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    must_change_password BOOLEAN DEFAULT false,
    
    -- Audit Trail
    last_login_at TIMESTAMP WITH TIME ZONE,
    last_login_ip TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- TABLE: admin_sessions
-- Purpose: Track active admin sessions (isolated from user sessions)
-- =====================================================
CREATE TABLE public.admin_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID REFERENCES public.admin_users(id) ON DELETE CASCADE,
    session_token TEXT UNIQUE NOT NULL,
    
    -- Session Metadata
    ip_address TEXT,
    user_agent TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Security
    is_valid BOOLEAN DEFAULT true,
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- TABLE: admin_audit_log
-- Purpose: Complete audit trail of all admin actions
-- =====================================================
CREATE TABLE public.admin_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
    
    -- Action Details
    action TEXT NOT NULL, -- login, logout, view_dashboard, export_data, etc.
    resource_type TEXT, -- user, transaction, settings, etc.
    resource_id TEXT,
    
    -- Context
    ip_address TEXT,
    user_agent TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    
    -- Status
    status TEXT CHECK (status IN ('success', 'failure', 'blocked')),
    error_message TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX idx_admin_users_email ON public.admin_users(email);
CREATE INDEX idx_admin_users_active ON public.admin_users(is_active) WHERE is_active = true;
CREATE INDEX idx_admin_sessions_token ON public.admin_sessions(session_token);
CREATE INDEX idx_admin_sessions_user ON public.admin_sessions(admin_user_id);
CREATE INDEX idx_admin_sessions_valid ON public.admin_sessions(is_valid) WHERE is_valid = true;
CREATE INDEX idx_admin_audit_log_user ON public.admin_audit_log(admin_user_id);
CREATE INDEX idx_admin_audit_log_action ON public.admin_audit_log(action);
CREATE INDEX idx_admin_audit_log_created ON public.admin_audit_log(created_at DESC);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Service role can manage admin_users" ON public.admin_users;
DROP POLICY IF EXISTS "Service role can manage admin_sessions" ON public.admin_sessions;
DROP POLICY IF EXISTS "Service role can manage admin_audit_log" ON public.admin_audit_log;

-- Service role has full access (for API routes)
CREATE POLICY "Service role can manage admin_users"
ON public.admin_users
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role can manage admin_sessions"
ON public.admin_sessions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role can manage admin_audit_log"
ON public.admin_audit_log
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- No direct access for anon/authenticated users
-- (All access goes through API routes with service role)

-- =====================================================
-- FUNCTIONS FOR SECURITY
-- =====================================================

-- Function to cleanup expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_admin_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM public.admin_sessions
    WHERE expires_at < NOW()
    OR (last_activity_at < NOW() - INTERVAL '1 hour' AND is_valid = true);
END;
$$;

-- Function to invalidate all sessions for a user
CREATE OR REPLACE FUNCTION invalidate_admin_user_sessions(user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.admin_sessions
    SET is_valid = false
    WHERE admin_user_id = user_id;
END;
$$;

-- Function to log admin action
CREATE OR REPLACE FUNCTION log_admin_action(
    p_admin_user_id UUID,
    p_action TEXT,
    p_resource_type TEXT DEFAULT NULL,
    p_resource_id TEXT DEFAULT NULL,
    p_ip_address TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_details JSONB DEFAULT '{}'::jsonb,
    p_status TEXT DEFAULT 'success',
    p_error_message TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    log_id UUID;
BEGIN
    INSERT INTO public.admin_audit_log (
        admin_user_id,
        action,
        resource_type,
        resource_id,
        ip_address,
        user_agent,
        details,
        status,
        error_message
    ) VALUES (
        p_admin_user_id,
        p_action,
        p_resource_type,
        p_resource_id,
        p_ip_address,
        p_user_agent,
        p_details,
        p_status,
        p_error_message
    )
    RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$;

-- =====================================================
-- TRIGGER: Update updated_at timestamp
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_admin_users_updated_at
BEFORE UPDATE ON public.admin_users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- INSERT INITIAL ADMIN USER (YOU!)
-- =====================================================
-- Note: Password will be set via API endpoint with proper bcrypt hashing
-- This is just a placeholder that requires password setup on first use

INSERT INTO public.admin_users (email, password_hash, role, is_active, must_change_password)
VALUES (
    'ricks_@live.nl',
    '$2b$10$placeholder.this.will.be.replaced.on.first.login',
    'super_admin',
    true,
    true
)
ON CONFLICT (email) DO NOTHING;

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON public.admin_users TO service_role;
GRANT ALL ON public.admin_sessions TO service_role;
GRANT ALL ON public.admin_audit_log TO service_role;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Admin authentication system created successfully!';
    RAISE NOTICE '📧 Initial admin: ricks_@live.nl';
    RAISE NOTICE '🔐 Password must be set on first login';
    RAISE NOTICE '🔒 2FA will be enforced after setup';
END $$;

