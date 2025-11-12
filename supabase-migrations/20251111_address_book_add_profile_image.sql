-- ============================================================================
-- 📸 ADDRESS BOOK - ADD PROFILE IMAGE SUPPORT
-- ============================================================================
-- Add profile_image column for custom contact photos
-- ============================================================================

ALTER TABLE address_book 
ADD COLUMN IF NOT EXISTS profile_image TEXT;

COMMENT ON COLUMN address_book.profile_image IS 'Base64 encoded profile image (128x128px) or external URL';

SELECT 'Profile image support added to address_book!' as message;

