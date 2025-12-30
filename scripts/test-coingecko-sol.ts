/**
 * Test script to check what CoinGecko API actually returns for SOL
 */

async function testCoinGeckoSOL() {
  console.log('🔍 Testing CoinGecko API for SOL price...\n');
  
  // Our current implementation
  const coinId = 'solana';
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true`;
  
  console.log('📡 URL:', url);
  console.log('');
  
  try {
    const response = await fetch(url, {
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
    
    console.log('✅ CoinGecko Response:');
    console.log(JSON.stringify(data, null, 2));
    console.log('');
    
    // Check what we get
    const solData = data['solana'];
    console.log('🔍 data["solana"]:', solData);
    console.log('');
    
    if (solData) {
      console.log('💰 SOL Price (USD):', solData.usd);
      console.log('📈 24h Change:', solData.usd_24h_change);
      console.log('');
      
      if (solData.usd && solData.usd > 0) {
        console.log('✅ SUCCESS: Valid price received!');
      } else {
        console.log('❌ PROBLEM: Price is 0 or missing!');
      }
    } else {
      console.log('❌ PROBLEM: No "solana" key in response!');
    }
    
  } catch (error: any) {
    console.error('❌ Fetch Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Also test with multiple symbols (like we do in production)
async function testCoinGeckoMultiple() {
  console.log('\n\n═══════════════════════════════════════════════════════════════');
  console.log('🔍 Testing CoinGecko API with MULTIPLE symbols (SOL + ETH)...\n');
  
  const coinIds = ['solana', 'ethereum'];
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinIds.join(',')}&vs_currencies=usd&include_24hr_change=true`;
  
  console.log('📡 URL:', url);
  console.log('');
  
  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });
    
    console.log('📊 Response Status:', response.status);
    console.log('');
    
    if (!response.ok) {
      console.log('❌ Response not OK');
      return;
    }
    
    const data = await response.json();
    
    console.log('✅ CoinGecko Response:');
    console.log(JSON.stringify(data, null, 2));
    console.log('');
    
    // Check SOL
    if (data['solana']) {
      console.log('✅ SOL: $' + data['solana'].usd);
    } else {
      console.log('❌ SOL: MISSING');
    }
    
    // Check ETH
    if (data['ethereum']) {
      console.log('✅ ETH: $' + data['ethereum'].usd);
    } else {
      console.log('❌ ETH: MISSING');
    }
    
  } catch (error: any) {
    console.error('❌ Fetch Error:', error.message);
  }
}

// Run tests
testCoinGeckoSOL().then(() => testCoinGeckoMultiple());

