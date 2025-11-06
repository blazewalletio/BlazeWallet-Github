#!/usr/bin/env node

/**
 * 🔐 Execute Full Migration via psql-style approach
 */

require('dotenv').config({ path: '.env.local' });
const { exec } = require('child_process');
const fs = require('fs');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

console.log('\n🔐 EXECUTING FULL MIGRATION...\n');

// Read SQL file
const sql = fs.readFileSync('temp-migration.sql', 'utf8');

// Use curl to execute SQL via Supabase REST API
const projectRef = supabaseUrl.split('//')[1].split('.')[0];
const apiUrl = `${supabaseUrl}/rest/v1/rpc/exec_sql`;

console.log('📡 Sending SQL to Supabase...\n');

const curl = `curl -X POST '${supabaseUrl}/rest/v1/rpc/exec' \
  -H "apikey: ${supabaseServiceKey}" \
  -H "Authorization: Bearer ${supabaseServiceKey}" \
  -H "Content-Type: application/json" \
  -d '{"query": ${JSON.stringify(sql)}}'`;

exec(curl, (error, stdout, stderr) => {
  if (error) {
    console.error('❌ Execution failed:', error.message);
    console.log('\n💡 MANUAL MIGRATION REQUIRED:\n');
    console.log('1. Open: https://app.supabase.com/project/_/sql/new');
    console.log('2. Copy contents of: temp-migration.sql');
    console.log('3. Click "Run"\n');
    return;
  }

  if (stderr) {
    console.error('⚠️  Warning:', stderr);
  }

  console.log('Response:', stdout);
  console.log('\n✅ Migration executed!\n');
});

