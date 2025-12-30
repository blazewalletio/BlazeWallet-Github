/**
 * Find the correct Binance ticker for CRO (Cronos)
 */

async function findCROTicker() {
  console.log('🔍 Finding correct Binance ticker for CRO...\n');
  
  const possibleTickers = [
    'CROUSDT',   // Standard
    'CROUSD',    // Alternative
    'CROBUSD',   // BUSD pair
    'CROBTC',    // BTC pair
    'CROETH',    // ETH pair
    'CROEUR',    // EUR pair
  ];
  
  for (const ticker of possibleTickers) {
    try {
      const url = `https://api.binance.com/api/v3/ticker/24hr?symbol=${ticker}`;
      const response = await fetch(url, {
        signal: AbortSignal.timeout(3000),
      });
      
      if (response.ok) {
        const data = await response.json();
        const price = parseFloat(data.lastPrice);
        console.log(`✅ ${ticker} WORKS! Price: $${price}`);
        return ticker;
      } else {
        console.log(`❌ ${ticker} failed (${response.status})`);
      }
    } catch (error: any) {
      console.log(`❌ ${ticker} error: ${error.message}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n⚠️  CRO is not available on Binance!');
  console.log('   Will rely on CoinGecko for CRO pricing.');
}

findCROTicker();

