-- Create function to mark user as unverified
-- This is needed because Supabase's auth.admin.updateUserById doesn't always work correctly

CREATE OR REPLACE FUNCTION mark_user_unverified(user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update the auth.users table to mark user as unverified
  UPDATE auth.users
  SET 
    email_confirmed_at = NULL,
    confirmation_sent_at = NOW(),
    updated_at = NOW()
  WHERE id = user_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION mark_user_unverified(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_user_unverified(UUID) TO service_role;

