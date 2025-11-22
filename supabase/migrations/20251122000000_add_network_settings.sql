-- ============================================================================
-- ADD NETWORK & TESTNET SETTINGS TO USER PROFILES
-- ============================================================================
-- Migration: 20251122000000_add_network_settings
-- Description: Add default_network and enable_testnets columns to user_profiles
-- 
-- FEATURES:
-- 1. default_network: User's preferred default blockchain network
-- 2. enable_testnets: Toggle to show/hide testnet chains
--
-- ============================================================================

-- Add default_network column (stores chain key like 'ethereum', 'bsc', etc.)
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS default_network TEXT DEFAULT 'ethereum';

-- Add enable_testnets column (default false for production users)
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS enable_testnets BOOLEAN DEFAULT false;

-- Add comments for documentation
COMMENT ON COLUMN public.user_profiles.default_network IS 'Default blockchain network shown on wallet startup (ethereum, bsc, polygon, etc.)';
COMMENT ON COLUMN public.user_profiles.enable_testnets IS 'Show testnet chains in network selector (sepolia, goerli, etc.)';

-- Create index for faster queries (optional but good practice)
CREATE INDEX IF NOT EXISTS idx_user_profiles_network_settings 
ON public.user_profiles(default_network, enable_testnets);

-- Update the updated_at timestamp trigger to include new columns
-- (trigger should already exist from previous migrations)

-- ============================================================================
-- DATA VALIDATION
-- ============================================================================

-- Add check constraint to ensure default_network is a valid chain key
-- (Optional: can be removed if we want full flexibility)
ALTER TABLE public.user_profiles
ADD CONSTRAINT check_default_network 
CHECK (default_network IN (
  -- Mainnets
  'ethereum', 'bsc', 'polygon', 'avalanche', 'arbitrum', 
  'optimism', 'base', 'solana', 'bitcoin', 'litecoin', 
  'dogecoin', 'bitcoincash',
  -- Testnets (only allowed when enable_testnets = true in app logic)
  'sepolia', 'goerli', 'bsc_testnet', 'polygon_mumbai'
));

-- ============================================================================
-- AUDIT LOGGING (track when users change network settings)
-- ============================================================================

-- Log when network settings change (optional but useful)
CREATE OR REPLACE FUNCTION log_network_settings_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.default_network IS DISTINCT FROM NEW.default_network) OR 
     (OLD.enable_testnets IS DISTINCT FROM NEW.enable_testnets) THEN
    
    INSERT INTO public.user_activity_log (
      user_id,
      activity_type,
      description,
      metadata
    ) VALUES (
      NEW.user_id,
      'settings_change',
      'Network settings updated',
      jsonb_build_object(
        'old_network', OLD.default_network,
        'new_network', NEW.default_network,
        'old_testnets', OLD.enable_testnets,
        'new_testnets', NEW.enable_testnets
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for network settings changes
DROP TRIGGER IF EXISTS trigger_log_network_settings_change ON public.user_profiles;
CREATE TRIGGER trigger_log_network_settings_change
  AFTER UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION log_network_settings_change();

-- ============================================================================
-- SEED DATA FOR EXISTING USERS
-- ============================================================================

-- Set default values for existing users (if any)
UPDATE public.user_profiles
SET 
  default_network = COALESCE(default_network, 'ethereum'),
  enable_testnets = COALESCE(enable_testnets, false)
WHERE 
  default_network IS NULL OR 
  enable_testnets IS NULL;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$ 
BEGIN 
  RAISE NOTICE '✅ Network settings migration completed successfully!';
  RAISE NOTICE '   - Added default_network column (default: ethereum)';
  RAISE NOTICE '   - Added enable_testnets column (default: false)';
  RAISE NOTICE '   - Created audit logging trigger';
END $$;

