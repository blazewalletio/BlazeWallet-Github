/**
 * Check Supabase database schema for trusted_devices table
 * This script checks what columns exist in the trusted_devices table
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✅' : '❌');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkSchema() {
  try {
    console.log('🔍 Checking trusted_devices table schema...\n');
    
    // Query the information_schema to get column details
    const { data, error } = await supabase.rpc('exec_sql', {
      query: `
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'trusted_devices'
        ORDER BY ordinal_position;
      `
    });

    if (error) {
      // Try alternative method - direct query
      console.log('⚠️  RPC method failed, trying direct query...\n');
      
      // Get a sample row to see what columns exist
      const { data: sampleData, error: sampleError } = await supabase
        .from('trusted_devices')
        .select('*')
        .limit(1);
      
      if (sampleError) {
        console.error('❌ Error querying table:', sampleError);
        
        // Try to get table info via PostgREST
        const { data: tableInfo, error: tableError } = await supabase
          .from('trusted_devices')
          .select('id')
          .limit(0);
        
        if (tableError && tableError.code === 'PGRST204') {
          console.error('\n❌ Table or column not found in schema cache');
          console.error('   This means the migration has not been run!');
        }
        return;
      }
      
      if (sampleData && sampleData.length > 0) {
        console.log('✅ Table exists. Columns found:\n');
        console.log(JSON.stringify(Object.keys(sampleData[0]), null, 2));
      } else {
        console.log('✅ Table exists but is empty');
      }
      
      // Check specific columns we need
      const requiredColumns = [
        'verification_code',
        'verification_code_expires_at',
        'verification_expires_at',
        'verification_token'
      ];
      
      console.log('\n🔍 Checking required columns:');
      const existingColumns = sampleData && sampleData.length > 0 ? Object.keys(sampleData[0]) : [];
      
      requiredColumns.forEach(col => {
        const exists = existingColumns.includes(col);
        console.log(`   ${exists ? '✅' : '❌'} ${col}`);
      });
      
      return;
    }
    
    if (data && data.length > 0) {
      console.log('📋 Columns in trusted_devices table:\n');
      data.forEach(col => {
        console.log(`   ${col.column_name.padEnd(35)} ${col.data_type.padEnd(20)} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
      });
      
      // Check for specific columns
      const columnNames = data.map(c => c.column_name);
      console.log('\n🔍 Checking required columns:');
      const requiredColumns = [
        'verification_code',
        'verification_code_expires_at',
        'verification_expires_at',
        'verification_token'
      ];
      
      requiredColumns.forEach(col => {
        const exists = columnNames.includes(col);
        console.log(`   ${exists ? '✅' : '❌'} ${col}`);
      });
    } else {
      console.log('⚠️  No columns found (table might not exist)');
    }
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

checkSchema();

