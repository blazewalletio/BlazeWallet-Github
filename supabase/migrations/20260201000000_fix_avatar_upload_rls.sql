-- ============================================================================
-- 🔧 FIX: Avatar Upload RLS Policy
-- ============================================================================
-- Problem: Storage RLS policy expects user_id in folder structure like:
--   avatars/{user_id}/{filename}
-- But code uploads to:
--   avatars/{user_id}-{timestamp}.{ext}
--
-- Solution: Fix policy to match actual upload pattern
-- ============================================================================

-- Drop old restrictive policies
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;

-- ✅ NEW: Allow authenticated users to upload avatars
-- Pattern: avatars/{user_id}-{timestamp}.{ext}
CREATE POLICY "Users can upload avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'user-uploads' 
  AND (storage.foldername(name))[1] = 'avatars'
  AND name LIKE 'avatars/' || auth.uid()::text || '%'
);

-- ✅ Allow users to update their own avatars (for upsert)
CREATE POLICY "Users can update their own avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'user-uploads' 
  AND (storage.foldername(name))[1] = 'avatars'
  AND name LIKE 'avatars/' || auth.uid()::text || '%'
);

-- ✅ Anyone can view avatars (public bucket)
CREATE POLICY "Public can view avatars"
ON storage.objects FOR SELECT
TO public
USING (
  bucket_id = 'user-uploads' 
  AND (storage.foldername(name))[1] = 'avatars'
);

-- ✅ Users can delete their own avatars
CREATE POLICY "Users can delete their own avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'user-uploads' 
  AND (storage.foldername(name))[1] = 'avatars'
  AND name LIKE 'avatars/' || auth.uid()::text || '%'
);

-- ✅ Service role can do everything (for backend operations)
CREATE POLICY "Service role full access to user-uploads"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'user-uploads');

-- ✅ Ensure bucket exists and is public
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-uploads',
  'user-uploads',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) 
DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

