-- Query to check current auth config
SELECT key, value 
FROM auth.config 
WHERE key IN ('mailer_autoconfirm', 'disable_signup', 'external_email_enabled')
ORDER BY key;

-- If you want to see ALL auth config:
-- SELECT * FROM auth.config;

