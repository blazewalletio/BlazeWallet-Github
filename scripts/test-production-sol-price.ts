/**
 * Test what the DEPLOYED /api/prices endpoint returns for SOL
 * This simulates what the client will receive in production
 */

async function testProductionPricesAPI() {
  console.log('🔍 Testing PRODUCTION /api/prices for SOL...\n');
  
  const productionUrl = 'https://blazewallet21-10.vercel.app/api/prices?symbols=SOL';
  
  console.log('📡 Fetching from:', productionUrl);
  console.log('');
  
  try {
    const response = await fetch(productionUrl, {
      headers: { 'Accept': 'application/json' },
    });
    
    console.log('📊 Response Status:', response.status);
    console.log('📊 Response OK:', response.ok);
    console.log('');
    
    if (!response.ok) {
      console.log('❌ Response not OK');
      const text = await response.text();
      console.log('Response body:', text);
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
      } else {
        console.log('❌ PROBLEM: SOL price is still 0 in production!');
        console.log('   This means the Binance fallback is not working yet.');
        console.log('   Wait for the new deployment to finish (commit a41ab280).');
      }
    } else {
      console.log('❌ PROBLEM: No SOL key in response!');
    }
    
  } catch (error: any) {
    console.error('❌ Fetch Error:', error.message);
  }
}

testProductionPricesAPI();

