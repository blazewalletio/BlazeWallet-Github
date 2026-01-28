#!/bin/bash

# Get connection string from env
if [ -f .env.local ]; then
  source .env.local
fi

# Extract DB connection details from Supabase URL
SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL}"
PROJECT_REF=$(echo "$SUPABASE_URL" | sed -n 's/.*https:\/\/\([^.]*\).*/\1/p')

echo "🔍 Checking live Supabase database..."
echo "Project: $PROJECT_REF"
echo ""

# We'll use the psql connection string format
# supabase provides: postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres

read -p "Enter your Supabase database password: " -s DB_PASSWORD
echo ""

# Run queries
psql "postgresql://postgres.ldehmephukevxumwdbwt:${DB_PASSWORD}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres" << 'SQL'

\echo '=== PART 1: USER_ID DATA FORMATS ==='
SELECT 
  'address_book' as table_name,
  COUNT(*) as total_rows,
  COUNT(*) FILTER (WHERE user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') as uuid_format,
  COUNT(*) FILTER (WHERE user_id LIKE '%@%') as email_format,
  ARRAY_AGG(DISTINCT LEFT(user_id, 30) ORDER BY LEFT(user_id, 30)) as sample_user_ids
FROM address_book;

SELECT 
  'wallets' as table_name,
  COUNT(*) as total_rows,
  COUNT(*) FILTER (WHERE user_id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') as uuid_format,
  COUNT(*) FILTER (WHERE user_id::text LIKE '%@%') as email_format
FROM wallets;

\echo ''
\echo '=== PART 2: RLS POLICIES FOR ADDRESS_BOOK ==='
SELECT 
  policyname,
  cmd,
  qual as using_clause
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'address_book'
ORDER BY policyname;

\echo ''
\echo '=== PART 3: COLUMN TYPES ==='
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('address_book', 'wallets', 'trusted_devices')
  AND column_name = 'user_id';

\echo ''
\echo '=== PART 4: RICKS DATA ==='
SELECT 
  'auth.users' as source,
  id,
  email
FROM auth.users
WHERE email = 'ricks_@live.nl';

SELECT 
  'address_book' as source,
  user_id,
  COUNT(*) as contact_count
FROM address_book
WHERE user_id = 'ricks_@live.nl' 
   OR user_id = (SELECT id::text FROM auth.users WHERE email = 'ricks_@live.nl')
GROUP BY user_id;

SQL

