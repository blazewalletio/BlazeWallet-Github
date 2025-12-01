-- Clear all priority list registrations
-- Run this in Supabase SQL Editor to reset the priority list

-- Delete all email verification tokens first (foreign key constraint)
DELETE FROM email_verification_tokens;

-- Delete all priority list registrations
DELETE FROM priority_list_registrations;

-- Reset the position counter (optional, will auto-reset on next insert)
-- The trigger will handle position numbering automatically

-- Verify deletion
SELECT COUNT(*) as remaining_registrations FROM priority_list_registrations;
-- Should return 0

