/**
 * Check Supabase database schema using Vercel environment variables
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.vercel' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables from Vercel:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✅' : '❌');
  console.error('\n💡 Run: vercel env pull .env.vercel');
  process.exit(1);
}

console.log('✅ Environment variables loaded from Vercel');
console.log('   Supabase URL:', supabaseUrl.substring(0, 30) + '...\n');

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

async function checkSchema() {
  try {
    console.log('🔍 Checking trusted_devices table schema in PRODUCTION database...\n');
    
    // Get a sample row to see what columns exist
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
      const sample = { ...sampleData[0] };
      // Remove sensitive data
      if (sample.user_id) sample.user_id = sample.user_id.substring(0, 8) + '...';
      if (sample.device_fingerprint) sample.device_fingerprint = sample.device_fingerprint.substring(0, 12) + '...';
      console.log(JSON.stringify(sample, null, 2));
      
      // Test if we can insert with verification_code_expires_at
      console.log('\n🧪 Testing if verification_code_expires_at column exists...');
      const testData = {
        user_id: '00000000-0000-0000-0000-000000000000',
        device_name: 'test-schema-check',
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
          console.error('\n💡 You need to run the migration in Supabase SQL Editor!');
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
      
    } else {
      console.log('✅ Table exists but is empty');
    }
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

checkSchema();

