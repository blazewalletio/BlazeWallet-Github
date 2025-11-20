-- 🔥 DISABLE SUPABASE EMAIL CONFIRMATION
-- This prevents Supabase from sending automatic confirmation emails
-- We handle email verification via custom Resend emails

-- Create a trigger that automatically confirms users upon creation
-- This bypasses Supabase's email confirmation flow entirely

CREATE OR REPLACE FUNCTION auto_confirm_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Immediately mark email as confirmed
  NEW.email_confirmed_at = NOW();
  NEW.confirmation_sent_at = NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created_auto_confirm ON auth.users;

-- Create trigger that runs BEFORE INSERT on auth.users
CREATE TRIGGER on_auth_user_created_auto_confirm
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION auto_confirm_user();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION auto_confirm_user() TO service_role;

-- ✅ This ensures:
-- 1. Every new user is automatically confirmed
-- 2. Supabase won't try to send confirmation emails
-- 3. We handle verification via our custom Resend emails
-- 4. Users can still sign in immediately after signup

