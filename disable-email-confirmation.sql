-- Disable automatic email confirmation in Supabase
-- This prevents Supabase from automatically sending confirmation emails
-- We handle email verification via custom Resend emails

-- Note: This SQL might not work as mailer_autoconfirm is controlled by Dashboard
-- The proper way is to change it in: Supabase Dashboard > Authentication > Settings

-- However, we can work around this by immediately confirming users after signup
-- See: app/api/send-welcome-email/route.ts

-- Check current auth config:
-- Run in Supabase SQL Editor to see current settings
SELECT * FROM auth.config;

