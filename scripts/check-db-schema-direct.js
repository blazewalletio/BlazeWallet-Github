/**
 * Direct database schema check using known Supabase URL
 */

const { createClient } = require('@supabase/supabase-js');

// From send-retroactive-welcome-emails.js
const SUPABASE_URL = 'https://ldehmephukevxumwdbwt.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkZWhtZXBodWtldnh1bXdkYnd0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTIwMDg2MSwiZXhwIjoyMDc2Nzc2ODYxfQ.nhpYh_LREwR-qO12LCzfO9K3zHz_49aO_fle4j_gw7c';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

async function checkSchema() {
  try {
    console.log('🔍 Checking trusted_devices table schema...\n');
    
    // Method 1: Try to get a sample row (this will show us what columns exist)
    console.log('📋 Method 1: Querying sample row...');
    const { data: sampleData, error: sampleError } = await supabase
      .from('trusted_devices')
      .select('*')
      .limit(1);
    
    if (sampleError) {
      console.error('❌ Error:', sampleError.message);
      console.error('   Code:', sampleError.code);
      console.error('   Details:', sampleError.details);
      
      if (sampleError.code === 'PGRST204') {
        console.error('\n❌ This means the table or column is not in the schema cache!');
      }
      return;
    }
    
    if (sampleData && sampleData.length > 0) {
      console.log('✅ Table exists and has data. Columns found:\n');
      const columns = Object.keys(sampleData[0]);
      columns.forEach(col => {
        console.log(`   ✅ ${col}`);
      });
      
      // Check specific columns we need
      console.log('\n🔍 Checking required columns:');
      const requiredColumns = [
        'verification_code',
        'verification_code_expires_at',
        'verification_expires_at',
        'verification_token'
      ];
      
      requiredColumns.forEach(col => {
        const exists = columns.includes(col);
        console.log(`   ${exists ? '✅' : '❌'} ${col} ${exists ? '' : '(MISSING!)'}`);
      });
      
      // Show sample data structure
      console.log('\n📊 Sample row structure:');
      console.log(JSON.stringify(sampleData[0], null, 2));
      
    } else {
      console.log('✅ Table exists but is empty');
      
      // Try to insert a test row to see what columns are accepted
      console.log('\n📋 Method 2: Testing column names with empty insert...');
      const testData = {
        user_id: '00000000-0000-0000-0000-000000000000', // Dummy UUID
        device_name: 'test',
        device_fingerprint: 'test-fingerprint-' + Date.now(),
        verification_code: '123456',
        verification_code_expires_at: new Date().toISOString()
      };
      
      const { error: insertError } = await supabase
        .from('trusted_devices')
        .insert(testData);
      
      if (insertError) {
        if (insertError.code === 'PGRST204') {
          console.error('❌ Column verification_code_expires_at does NOT exist!');
          console.error('   Error:', insertError.message);
        } else {
          console.error('❌ Insert error:', insertError.message);
        }
      } else {
        console.log('✅ Column verification_code_expires_at EXISTS!');
        // Clean up test row
        await supabase
          .from('trusted_devices')
          .delete()
          .eq('device_fingerprint', testData.device_fingerprint);
      }
    }
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

checkSchema();

