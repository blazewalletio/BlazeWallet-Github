/**
 * Test if Binance supports all our native chain tokens
 */

const binanceSymbols = {
  'SOL': 'SOLUSDT',
  'BTC': 'BTCUSDT',
  'ETH': 'ETHUSDT',
  'BNB': 'BNBUSDT',
  'tBNB': 'BNBUSDT',
  'MATIC': 'MATICUSDT',
  'AVAX': 'AVAXUSDT',
  'FTM': 'FTMUSDT',
  'CRO': 'CROUSDT',
  'LTC': 'LTCUSDT',
  'DOGE': 'DOGEUSDT',
  'BCH': 'BCHUSDT',
  'ARB': 'ARBUSDT',
  'OP': 'OPUSDT',
};

async function testBinanceSupport() {
  console.log('🔍 Testing Binance API support for ALL chain native tokens...\n');
  
  const results: Record<string, { success: boolean; price?: number; error?: string }> = {};
  
  for (const [symbol, binanceSymbol] of Object.entries(binanceSymbols)) {
    try {
      const url = `https://api.binance.com/api/v3/ticker/24hr?symbol=${binanceSymbol}`;
      const response = await fetch(url, {
        signal: AbortSignal.timeout(5000),
      });
      
      if (response.ok) {
        const data = await response.json();
        const price = parseFloat(data.lastPrice);
        results[symbol] = { success: true, price };
        console.log(`✅ ${symbol.padEnd(6)} (${binanceSymbol.padEnd(10)}) → $${price.toFixed(2)}`);
      } else {
        const errorText = await response.text();
        results[symbol] = { success: false, error: `HTTP ${response.status}: ${errorText.substring(0, 50)}` };
        console.log(`❌ ${symbol.padEnd(6)} (${binanceSymbol.padEnd(10)}) → ${response.status}`);
      }
    } catch (error: any) {
      results[symbol] = { success: false, error: error.message };
      console.log(`❌ ${symbol.padEnd(6)} (${binanceSymbol.padEnd(10)}) → ${error.message}`);
    }
    
    // Rate limiting: 50ms delay between requests
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('📊 SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');
  
  const successCount = Object.values(results).filter(r => r.success).length;
  const failCount = Object.values(results).filter(r => !r.success).length;
  
  console.log(`✅ Supported: ${successCount}/${Object.keys(binanceSymbols).length}`);
  console.log(`❌ Not Supported: ${failCount}/${Object.keys(binanceSymbols).length}`);
  
  if (failCount > 0) {
    console.log('\n⚠️  FAILED TOKENS:');
    Object.entries(results).forEach(([symbol, result]) => {
      if (!result.success) {
        console.log(`   - ${symbol}: ${result.error}`);
      }
    });
  }
}

testBinanceSupport();

