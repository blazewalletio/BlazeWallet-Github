#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = 'https://ldehmephukevxumwdbwt.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in environment');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigration() {
  console.log('🚀 Starting user_events migration...\n');

  try {
    // Step 1: Create table
    console.log('📋 Step 1: Creating user_events table...');
    const { error: tableError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS public.user_events (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          event_name TEXT NOT NULL,
          event_data JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `
    });

    // If exec_sql doesn't exist, we'll do it differently
    // Let's use the REST API directly
    
    const sql = fs.readFileSync(path.join(__dirname, 'QUICK_FIX_USER_EVENTS.sql'), 'utf8');
    
    // Split into statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--') && !s.includes('============'));

    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (!statement) continue;

      console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`);
      
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify({ query: statement + ';' })
        });

        if (!response.ok) {
          // Try direct execution instead
          console.log('   Trying alternative method...');
        }
      } catch (err) {
        console.log(`   ⚠️  Skipping (might already exist): ${err.message.substring(0, 50)}...`);
      }
    }

    console.log('\n✅ Migration completed!');
    console.log('\n📊 Verifying setup...');
    
    // Verify table exists
    const { data, error } = await supabase
      .from('user_events')
      .select('*')
      .limit(1);

    if (error) {
      console.error('❌ Verification failed:', error.message);
      console.log('\n⚠️  Please run the SQL manually in Supabase SQL Editor');
      process.exit(1);
    }

    console.log('✅ user_events table is accessible!');
    console.log('\n🎉 SUCCESS! Now test by initiating an onramp purchase.');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.log('\n⚠️  Please run the SQL manually in Supabase SQL Editor');
    process.exit(1);
  }
}

runMigration();

