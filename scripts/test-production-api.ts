/**
 * Test the LIVE production /api/prices endpoint at my.blazewallet.io
 */

async function testProductionAPI() {
  console.log('🔍 Testing PRODUCTION /api/prices for SOL...\n');
  
  const productionUrl = 'https://my.blazewallet.io/api/prices?symbols=SOL';
  
  console.log('📡 URL:', productionUrl);
  console.log('⏰ Timestamp:', new Date().toISOString());
  console.log('');
  
  try {
    const response = await fetch(productionUrl, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    
    console.log('📊 Response Status:', response.status);
    console.log('📊 Response Headers:');
    console.log('   Content-Type:', response.headers.get('content-type'));
    console.log('   Cache-Control:', response.headers.get('cache-control'));
    console.log('');
    
    if (!response.ok) {
      console.log('❌ Response not OK');
      const text = await response.text();
      console.log('Response body:', text.substring(0, 500));
      return;
    }
    
    const data = await response.json();
    
    console.log('✅ API Response:');
    console.log(JSON.stringify(data, null, 2));
    console.log('');
    
    if (data.SOL) {
      console.log('💰 SOL Price:', data.SOL.price);
      console.log('📈 SOL 24h Change:', data.SOL.change24h);
      console.log('');
      
      if (data.SOL.price > 0) {
        console.log('✅ SUCCESS: SOL has valid price in production!');
        console.log(`   Price: $${data.SOL.price}`);
        console.log('   🎉 The fix is working!');
      } else {
        console.log('❌ PROBLEM: SOL price is still 0 in production!');
        console.log('   The Binance fallback is NOT working.');
        console.log('   Need to check Vercel logs for the debug output.');
      }
    } else {
      console.log('❌ PROBLEM: No SOL key in response!');
    }
    
  } catch (error: any) {
    console.error('❌ Fetch Error:', error.message);
    console.error('   This could indicate a network issue or timeout.');
  }
}

// Run multiple times with delays to catch the new deployment
async function runTests() {
  console.log('🔄 Testing production API (will retry if deployment is still in progress)...\n');
  
  for (let i = 1; i <= 3; i++) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`TEST ATTEMPT ${i}/3`);
    console.log('='.repeat(70));
    await testProductionAPI();
    
    if (i < 3) {
      console.log('\n⏳ Waiting 30 seconds before next test...\n');
      await new Promise(resolve => setTimeout(resolve, 30000));
    }
  }
}

runTests();

