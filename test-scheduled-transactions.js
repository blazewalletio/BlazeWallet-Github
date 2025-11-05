// ============================================================================
// 🔍 BLAZE WALLET - SCHEDULED TRANSACTIONS DIAGNOSTIC TEST
// ============================================================================
// Run this in your browser console (F12) while on the wallet page
// ============================================================================

(async function diagnosticTest() {
  console.log('🔍 === SCHEDULED TRANSACTIONS DIAGNOSTIC TEST ===');
  console.log('');
  
  // 1. Check localStorage for user info
  console.log('📋 Step 1: Check User Info');
  const walletEmail = localStorage.getItem('wallet_email');
  const supabaseUserId = localStorage.getItem('supabase_user_id');
  const encryptedWallet = localStorage.getItem('encrypted_wallet');
  
  console.log('- wallet_email:', walletEmail || 'NOT FOUND ❌');
  console.log('- supabase_user_id:', supabaseUserId || 'NOT FOUND ❌');
  console.log('- encrypted_wallet:', encryptedWallet ? 'EXISTS ✅' : 'NOT FOUND ❌');
  console.log('');
  
  // 2. Try to get wallet address from encrypted wallet
  let walletAddress = null;
  if (encryptedWallet) {
    try {
      const parsed = JSON.parse(encryptedWallet);
      walletAddress = parsed.solanaAddress || parsed.evmAddress || parsed.btcAddress;
      console.log('- Extracted address:', walletAddress);
    } catch (e) {
      console.error('- Failed to parse encrypted_wallet:', e);
    }
  }
  console.log('');
  
  // 3. Determine user_id to use
  const userId = walletEmail || walletAddress || 'UNKNOWN';
  console.log('📋 Step 2: User ID to use for API call');
  console.log('- userId:', userId);
  console.log('');
  
  // 4. Test API call for ALL transactions
  console.log('📋 Step 3: Test API - ALL transactions (no filters)');
  try {
    const response = await fetch(`/api/smart-scheduler/list?user_id=${encodeURIComponent(userId)}&status=all`);
    const data = await response.json();
    
    console.log('- Response status:', response.status);
    console.log('- Success:', data.success);
    console.log('- Count:', data.count);
    
    if (data.count > 0) {
      console.log('✅ Found', data.count, 'transaction(s)!');
      console.log('- Transactions:', data.data);
      
      // Show details of each transaction
      data.data.forEach((tx, i) => {
        console.log(`\n  Transaction ${i + 1}:`);
        console.log('  - ID:', tx.id);
        console.log('  - Chain:', tx.chain);
        console.log('  - Status:', tx.status);
        console.log('  - Amount:', tx.amount, tx.token_symbol || 'native');
        console.log('  - Scheduled for:', tx.scheduled_for || 'NOT SET ❌');
        console.log('  - Created:', tx.created_at);
      });
    } else {
      console.log('❌ No transactions found in database');
      console.log('   This means the transaction was NOT saved to Supabase');
    }
  } catch (error) {
    console.error('❌ API call failed:', error);
  }
  console.log('');
  
  // 5. Test API call for PENDING transactions only
  console.log('📋 Step 4: Test API - PENDING transactions only');
  try {
    const response = await fetch(`/api/smart-scheduler/list?user_id=${encodeURIComponent(userId)}&status=pending`);
    const data = await response.json();
    
    console.log('- Response status:', response.status);
    console.log('- Count:', data.count);
    
    if (data.count > 0) {
      console.log('✅ Found', data.count, 'PENDING transaction(s)!');
      console.log('   These SHOULD be visible in the Upcoming Transactions banner');
    } else {
      console.log('❌ No PENDING transactions found');
      console.log('   Possible reasons:');
      console.log('   1. Transaction was never saved to Supabase');
      console.log('   2. Transaction status is not "pending" (might be "completed", "failed", etc.)');
      console.log('   3. RLS policy is blocking access');
    }
  } catch (error) {
    console.error('❌ API call failed:', error);
  }
  console.log('');
  
  // 6. Test API call for Solana chain specifically
  console.log('📋 Step 5: Test API - PENDING transactions on Solana');
  try {
    const response = await fetch(`/api/smart-scheduler/list?user_id=${encodeURIComponent(userId)}&chain=solana&status=pending`);
    const data = await response.json();
    
    console.log('- Response status:', response.status);
    console.log('- Count:', data.count);
    
    if (data.count > 0) {
      console.log('✅ Found', data.count, 'PENDING Solana transaction(s)!');
    } else {
      console.log('❌ No PENDING Solana transactions found');
    }
  } catch (error) {
    console.error('❌ API call failed:', error);
  }
  console.log('');
  
  console.log('🔍 === DIAGNOSTIC TEST COMPLETE ===');
  console.log('');
  console.log('💡 NEXT STEPS:');
  console.log('1. If "No transactions found in database" → Transaction was never saved');
  console.log('2. If transactions found but status ≠ "pending" → Check why status changed');
  console.log('3. If transactions found but not in banner → UI rendering issue');
  console.log('');
  console.log('📋 Copy this entire console output and share it for analysis!');
})();

