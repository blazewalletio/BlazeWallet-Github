/**
 * Test the LIVE production /api/prices endpoint
 */

async function testLiveAPI() {
  console.log('🔍 Testing LIVE /api/prices endpoint for SOL...\n');
  
  // Get the actual production URL from the deployment
  const urls = [
    'https://blaze-wallet.vercel.app/api/prices?symbols=SOL',
    'https://blazewallet.vercel.app/api/prices?symbols=SOL',
    'https://www.blazewallet.io/api/prices?symbols=SOL',
  ];
  
  for (const url of urls) {
    console.log(`📡 Trying: ${url}`);
    try {
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000),
      });
      
      console.log(`   Status: ${response.status}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`   ✅ Response:`, JSON.stringify(data, null, 2));
        
        if (data.SOL) {
          if (data.SOL.price > 0) {
            console.log(`\n✅ SUCCESS! SOL price is $${data.SOL.price}`);
          } else {
            console.log(`\n❌ PROBLEM: SOL price is still $0`);
            console.log(`   The Binance fallback is NOT working on the server!`);
          }
        }
        break;
      } else {
        const text = await response.text();
        console.log(`   ❌ Error: ${text.substring(0, 100)}`);
      }
    } catch (error: any) {
      console.log(`   ❌ Failed: ${error.message}`);
    }
    console.log('');
  }
}

testLiveAPI();

