/**
 * Simulate the exact server-side /api/prices logic to debug why Binance fallback isn't triggering
 */

// Simulate symbolToId mapping from route.ts
const symbolToId: Record<string, string> = {
  'ETH': 'ethereum',
  'SOL': 'solana',
  'BTC': 'bitcoin',
  'MATIC': 'matic-network',
  'BNB': 'binancecoin',
  'AVAX': 'avalanche-2',
  'FTM': 'fantom',
  'LTC': 'litecoin',
  'DOGE': 'dogecoin',
  'BCH': 'bitcoin-cash',
};

async function testServerLogic() {
  console.log('🔍 Simulating /api/prices?symbols=SOL server-side logic...\n');
  
  const symbols = ['SOL'];
  let data: any = null;
  let coinGeckoFailed = false;
  
  // ✅ STEP 1: Try CoinGecko
  console.log('📡 STEP 1: Trying CoinGecko...');
  try {
    const apiKey = process.env.COINGECKO_API_KEY?.trim() || '';
    const apiKeyParam = apiKey ? `&x_cg_demo_api_key=${apiKey}` : '';
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd&include_24hr_change=true${apiKeyParam}`;
    
    console.log(`   URL: ${url.substring(0, 100)}...`);
    console.log(`   API Key: ${apiKey ? 'Yes' : 'No (using free tier)'}`);
    
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    
    console.log(`   Response status: ${response.status}`);
    
    if (!response.ok) {
      console.log(`   ❌ CoinGecko failed with ${response.status}`);
      coinGeckoFailed = true;
    } else {
      data = await response.json();
      console.log(`   ✅ CoinGecko response:`, JSON.stringify(data, null, 2));
    }
  } catch (error: any) {
    console.log(`   ❌ CoinGecko error: ${error.message}`);
    coinGeckoFailed = true;
  }
  
  // ✅ STEP 2: Check if Binance fallback is needed
  console.log('\n🔍 STEP 2: BINANCE FALLBACK CHECK:');
  console.log(`   coinGeckoFailed: ${coinGeckoFailed}`);
  console.log(`   data exists: ${!!data}`);
  console.log(`   data keys: ${data ? Object.keys(data).join(', ') : 'N/A'}`);
  
  symbols.forEach(symbol => {
    const coinId = symbolToId[symbol.toUpperCase()];
    if (coinId && data) {
      const price = data[coinId]?.usd || 0;
      console.log(`   ${symbol} (${coinId}): price = $${price}, has zero price: ${price === 0}`);
    }
  });
  
  const needsBinanceFallback = coinGeckoFailed || !data || 
    symbols.some(symbol => {
      const coinId = symbolToId[symbol.toUpperCase()];
      if (!coinId) return false;
      const price = data[coinId]?.usd || 0;
      return price === 0;
    });
  
  console.log(`   🎯 DECISION: needsBinanceFallback = ${needsBinanceFallback}`);
  
  // ✅ STEP 3: Try Binance if needed
  if (needsBinanceFallback) {
    console.log('\n📡 STEP 3: Trying Binance fallback...');
    
    if (!data) data = {};
    
    try {
      const binanceUrl = 'https://api.binance.com/api/v3/ticker/24hr?symbol=SOLUSDT';
      console.log(`   URL: ${binanceUrl}`);
      
      const binanceResponse = await fetch(binanceUrl, {
        signal: AbortSignal.timeout(5000),
      });
      
      console.log(`   Response status: ${binanceResponse.status}`);
      
      if (binanceResponse.ok) {
        const binanceData = await binanceResponse.json();
        const coinId = symbolToId['SOL'];
        
        data[coinId] = {
          usd: parseFloat(binanceData.lastPrice),
          usd_24h_change: parseFloat(binanceData.priceChangePercent),
        };
        
        console.log(`   ✅ Binance price: $${data[coinId].usd} (${data[coinId].usd_24h_change >= 0 ? '+' : ''}${data[coinId].usd_24h_change.toFixed(2)}%)`);
      } else {
        console.log(`   ❌ Binance failed`);
      }
    } catch (error: any) {
      console.log(`   ❌ Binance error: ${error.message}`);
    }
  }
  
  // ✅ STEP 4: Build final response
  console.log('\n📦 STEP 4: Building final response...');
  const result: Record<string, { price: number; change24h: number }> = {};
  
  const coinId = symbolToId['SOL'];
  const coinData = data[coinId];
  
  if (coinData && coinData.usd) {
    result['SOL'] = {
      price: coinData.usd || 0,
      change24h: coinData.usd_24h_change || 0,
    };
    console.log(`   ✅ SOL final: $${result['SOL'].price}`);
  } else {
    result['SOL'] = { price: 0, change24h: 0 };
    console.log(`   ❌ SOL final: $0 (no data)`);
  }
  
  console.log('\n✅ FINAL RESPONSE:', JSON.stringify(result, null, 2));
}

testServerLogic();

