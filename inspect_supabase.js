const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ldehmephukevxumwdbwt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkZWhtZXBodWtldnh1bXdkYnd0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTIwMDg2MSwiZXhwIjoyMDc2Nzc2ODYxfQ.nhpYh_LREwR-qO12LCzfO9K3zHz_49aO_fle4j_gw7c';

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectDatabase() {
  console.log('🔍 Inspecting Supabase database...\n');
  
  // 1. Get function definition
  console.log('📊 Getting check_2fa_session function definition...');
  const { data: funcData, error: funcError } = await supabase.rpc('pg_get_functiondef', {
    func_oid: 'check_2fa_session'
  });
  
  if (funcError) {
    console.log('❌ Error getting function:', funcError);
  } else {
    console.log('✅ Function data:', funcData);
  }
  
  // 2. Get user_2fa_sessions table structure
  console.log('\n📊 Getting user_2fa_sessions table structure...');
  const { data: tableData, error: tableError } = await supabase
    .from('user_2fa_sessions')
    .select('*')
    .limit(0);
  
  if (tableError) {
    console.log('❌ Error getting table:', tableError);
  } else {
    console.log('✅ Table structure retrieved');
  }
  
  // 3. Raw SQL query via REST API
  console.log('\n📊 Executing raw SQL to get function source...');
  const query = `
    SELECT 
      p.proname AS function_name,
      p.prosrc AS function_source,
      pg_get_functiondef(p.oid) AS full_definition
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'check_2fa_session'
      AND n.nspname = 'public';
  `;
  
  try {
    const response = await fetch('https://ldehmephukevxumwdbwt.supabase.co/rest/v1/rpc/sql', {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query })
    });
    
    const result = await response.json();
    console.log('Raw SQL result:', JSON.stringify(result, null, 2));
  } catch (err) {
    console.log('❌ Raw SQL error:', err.message);
  }
  
  // 4. Check which tables have 'expires_at' column
  console.log('\n📊 Finding all tables with expires_at column...');
  const tablesQuery = `
    SELECT 
      table_name,
      column_name,
      data_type
    FROM information_schema.columns
    WHERE column_name = 'expires_at'
      AND table_schema = 'public'
    ORDER BY table_name;
  `;
  
  console.log('Query:', tablesQuery);
}

inspectDatabase().catch(console.error);

