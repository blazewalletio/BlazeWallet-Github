-- 🔥 QUERY 2: Wat doet de trigger functie precies?
-- Run deze en stuur de volledige output (kan lang zijn!)

SELECT pg_get_functiondef(oid) as function_definition
FROM pg_proc
WHERE proname = 'create_user_profile_on_signup';

