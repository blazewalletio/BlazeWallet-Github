-- Check all tables in auth schema
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'auth' 
ORDER BY tablename;

-- Check if there are any missing auth tables
-- GoTH Auth expects these tables:
-- users, identities, sessions, refresh_tokens, audit_log_entries, etc.

