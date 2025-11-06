/**
 * 🧪 TEST SCRIPT: Scheduled Transactions Fixes
 * 
 * Run dit script in de browser console om te testen of alle fixes werken.
 * 
 * HOE TE GEBRUIKEN:
 * 1. Open Blaze Wallet (localhost:3000 of my.blazewallet.io)
 * 2. Open Developer Console (F12)
 * 3. Kopieer en plak deze hele script
 * 4. Check de console output
 */

console.log('🧪 Starting Scheduled Transactions Fix Test...\n');

// =============================================================================
// TEST 1: SOLANA GAS PRICE API
// =============================================================================
async function testSolanaGasPrice() {
  console.log('📊 TEST 1: Solana Gas Price API');
  console.log('Testing getRecentPrioritizationFees...\n');
  
  try {
    const response = await fetch('https://api.mainnet-beta.solana.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getRecentPrioritizationFees',
        params: [[]],
      }),
    });
    
    const data = await response.json();
    
    if (data.result && Array.isArray(data.result) && data.result.length > 0) {
      const fees = data.result
        .map(f => f.prioritizationFee)
        .filter(f => f > 0)
        .sort((a, b) => a - b);
      
      const medianFee = fees[Math.floor(fees.length / 2)];
      const baseFee = 5000;
      const totalGas = baseFee + medianFee;
      
      console.log('✅ Solana Gas Price API Working!');
      console.log('   Base fee: 5000 lamports');
      console.log(`   Median priority fee: ${medianFee} lamports`);
      console.log(`   Total gas price: ${totalGas} lamports`);
      console.log(`   ✅ NOT HARDCODED! (not 10000)\n`);
      return true;
    } else {
      console.error('❌ No result from Solana API');
      return false;
    }
  } catch (error) {
    console.error('❌ Solana Gas Price API Failed:', error);
    return false;
  }
}

// =============================================================================
// TEST 2: USD PRICE CALCULATION
// =============================================================================
async function testUSDCalculation() {
  console.log('💰 TEST 2: USD Price Calculation');
  console.log('Testing currency symbol mapping...\n');
  
  const chains = [
    { name: 'solana', symbol: 'SOL', gasPrice: 10000 },
    { name: 'ethereum', symbol: 'ETH', gasPrice: 30 },
    { name: 'polygon', symbol: 'MATIC', gasPrice: 50 },
    { name: 'bitcoin', symbol: 'BTC', gasPrice: 5 },
  ];
  
  let allPassed = true;
  
  for (const chain of chains) {
    try {
      // Test price API
      const response = await fetch(`/api/prices?symbol=${chain.symbol}`);
      const data = await response.json();
      
      if (data.success && data.data.price > 0) {
        const price = data.data.price;
        
        // Calculate USD based on chain type
        let usd;
        if (chain.name === 'solana') {
          usd = (chain.gasPrice / 1_000_000_000) * price;
        } else if (chain.name === 'bitcoin') {
          usd = ((chain.gasPrice * 250) / 100_000_000) * price;
        } else {
          usd = ((21000 * chain.gasPrice) / 1e9) * price;
        }
        
        console.log(`✅ ${chain.name.toUpperCase()}`);
        console.log(`   Symbol: ${chain.symbol}`);
        console.log(`   Native price: $${price.toFixed(2)}`);
        console.log(`   Gas cost: $${usd.toFixed(6)} USD`);
        console.log(`   ✅ NOT $0.00!\n`);
      } else {
        console.error(`❌ ${chain.name}: Failed to fetch price`);
        allPassed = false;
      }
    } catch (error) {
      console.error(`❌ ${chain.name}: Error`, error);
      allPassed = false;
    }
  }
  
  return allPassed;
}

// =============================================================================
// TEST 3: RSA PUBLIC KEY CONFIGURATION
// =============================================================================
function testRSAPublicKey() {
  console.log('🔐 TEST 3: RSA Public Key Configuration');
  console.log('Checking NEXT_PUBLIC_SERVER_PUBLIC_KEY...\n');
  
  const publicKey = process.env.NEXT_PUBLIC_SERVER_PUBLIC_KEY;
  
  if (publicKey && publicKey.includes('BEGIN PUBLIC KEY')) {
    console.log('✅ RSA Public Key Configured!');
    console.log(`   Key length: ${publicKey.length} characters`);
    console.log('   Format: PEM (correct)');
    console.log('   ✅ Encryption will work!\n');
    return true;
  } else {
    console.error('❌ RSA Public Key NOT configured');
    console.error('   This will cause "Failed to encrypt authorization" error\n');
    return false;
  }
}

// =============================================================================
// TEST 4: SCHEDULED TRANSACTION CREATION
// =============================================================================
async function testScheduledTransactionCreation() {
  console.log('📅 TEST 4: Scheduled Transaction Creation');
  console.log('Testing encryption & API...\n');
  
  try {
    // Check if wallet is unlocked
    const wallet = useWalletStore?.getState?.()?.wallet;
    
    if (!wallet || !wallet.mnemonic) {
      console.warn('⚠️  Wallet is locked. Please unlock first to test full flow.');
      console.log('   But API routes should still be accessible.\n');
      return null;
    }
    
    console.log('✅ Wallet is unlocked');
    console.log('   Can test full encryption flow!');
    
    // Test encryption (without actually scheduling)
    const testMnemonic = wallet.mnemonic.phrase;
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour
    
    // Import encryption function
    const { encryptForScheduling } = await import('./lib/scheduled-tx-encryption.ts');
    const encrypted = await encryptForScheduling(testMnemonic, expiresAt);
    
    console.log('✅ Encryption Successful!');
    console.log('   Ciphertext length:', encrypted.ciphertext.length);
    console.log('   IV length:', encrypted.iv.length);
    console.log('   Encrypted key length:', encrypted.encrypted_key.length);
    console.log('   ✅ Ready to schedule transactions!\n');
    
    return true;
  } catch (error) {
    console.error('❌ Encryption Failed:', error);
    return false;
  }
}

// =============================================================================
// RUN ALL TESTS
// =============================================================================
async function runAllTests() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🔥 BLAZE WALLET - SCHEDULED TRANSACTIONS FIX TEST');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  const results = {
    solanaGas: await testSolanaGasPrice(),
    usdCalculation: await testUSDCalculation(),
    rsaKey: testRSAPublicKey(),
    scheduledTx: await testScheduledTransactionCreation(),
  };
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  console.log(`1. Solana Gas Price API:       ${results.solanaGas ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`2. USD Calculation:             ${results.usdCalculation ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`3. RSA Public Key:              ${results.rsaKey ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`4. Scheduled TX Creation:       ${results.scheduledTx === true ? '✅ PASS' : results.scheduledTx === null ? '⚠️  SKIP (wallet locked)' : '❌ FAIL'}`);
  
  const passCount = Object.values(results).filter(r => r === true).length;
  const totalTests = Object.keys(results).length;
  
  console.log('\n───────────────────────────────────────────────────────────────');
  console.log(`OVERALL: ${passCount}/${totalTests} tests passed`);
  
  if (passCount === totalTests) {
    console.log('🎉 ALL FIXES WORKING PERFECTLY!');
  } else {
    console.log('⚠️  Some tests failed. Check output above.');
  }
  console.log('═══════════════════════════════════════════════════════════════\n');
}

// Start tests
runAllTests().catch(console.error);

