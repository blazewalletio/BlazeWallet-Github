// ============================================================================
// 🔥 BROWSER CONSOLE TEST - SCHEDULED TRANSACTIONS
// ============================================================================
// Run this in browser console to test if API works
// ============================================================================

console.log('========== TESTING SCHEDULED TRANSACTIONS API ==========');

// Test 1: Direct API call
async function testDirectAPI() {
  console.log('\n📋 TEST 1: Direct API call');
  
  const userId = 'ricks_@live.nl';
  const apiUrl = `https://my.blazewallet.io/api/smart-scheduler/list?user_id=${encodeURIComponent(userId)}&status=pending`;
  
  console.log('🔍 Calling:', apiUrl);
  
  try {
    const response = await fetch(apiUrl);
    const data = await response.json();
    
    console.log('📊 Response status:', response.status);
    console.log('📦 Response data:', data);
    
    if (data.success && data.count > 0) {
      console.log(`✅ SUCCESS: Found ${data.count} transaction(s)`);
      console.log('📄 First transaction:', data.data[0]);
      return data.data;
    } else if (data.success && data.count === 0) {
      console.warn('⚠️ API works but returned 0 transactions');
      console.log('This means RLS policies might still be blocking');
      return [];
    } else {
      console.error('❌ API call failed:', data.error);
      return null;
    }
  } catch (error) {
    console.error('❌ Network error:', error);
    return null;
  }
}

// Test 2: Check if transactions exist with service_role
async function testSupabaseDirect() {
  console.log('\n🗄️ TEST 2: Direct Supabase query (if you have client)');
  console.log('Note: This requires Supabase client to be loaded');
  
  try {
    // This will only work if Supabase client is available
    if (typeof window.supabase !== 'undefined') {
      const { data, error } = await window.supabase
        .from('scheduled_transactions')
        .select('*')
        .eq('user_id', 'ricks_@live.nl')
        .eq('status', 'pending');
      
      if (error) {
        console.error('❌ Supabase error:', error);
      } else {
        console.log('✅ Direct Supabase query result:', data);
        console.log(`Found ${data.length} transaction(s)`);
      }
    } else {
      console.log('⚠️ Supabase client not available in window');
    }
  } catch (error) {
    console.log('⚠️ Cannot test direct Supabase query:', error.message);
  }
}

// Test 3: Check RLS policies (requires SQL access)
function showSQLTest() {
  console.log('\n📝 TEST 3: SQL to run in Supabase Dashboard');
  console.log('Copy this SQL and run in Supabase SQL Editor:\n');
  
  const sql = `
-- Test if service_role can read transactions
SELECT COUNT(*) as total_count
FROM scheduled_transactions
WHERE user_id = 'ricks_@live.nl' 
AND status = 'pending';

-- Check current RLS policies
SELECT schemaname, tablename, policyname, roles, cmd
FROM pg_policies
WHERE tablename = 'scheduled_transactions';
  `;
  
  console.log(sql);
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting all tests...\n');
  
  const apiResult = await testDirectAPI();
  await testSupabaseDirect();
  showSQLTest();
  
  console.log('\n========== TEST SUMMARY ==========');
  if (apiResult && apiResult.length > 0) {
    console.log('✅ API WORKS! Transactions found:', apiResult.length);
    console.log('🎉 The problem should be fixed!');
    console.log('💡 If banner still not showing, hard refresh: Cmd+Shift+R');
  } else if (apiResult && apiResult.length === 0) {
    console.log('⚠️ API works but returns 0 transactions');
    console.log('🔍 Possible causes:');
    console.log('   1. RLS policies still blocking SELECT');
    console.log('   2. Transactions were deleted/expired');
    console.log('   3. User ID mismatch');
    console.log('💡 Run the SQL test above to debug further');
  } else {
    console.log('❌ API call failed');
    console.log('🔍 Check console for errors above');
  }
  console.log('====================================\n');
}

// Auto-run tests
runAllTests();


