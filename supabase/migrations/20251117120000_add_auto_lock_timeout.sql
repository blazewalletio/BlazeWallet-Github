-- Add auto_lock_timeout column to user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS auto_lock_timeout INTEGER DEFAULT 5;

COMMENT ON COLUMN user_profiles.auto_lock_timeout IS 'Auto-lock timeout in minutes. 0 = never lock.';

