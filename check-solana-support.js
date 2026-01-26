const LIFI_API_KEY = '02dff428-23bb-4731-b449-89f63892353a.d0967ed5-1aec-4c87-992a-564b56b7c295';

async function checkSolanaSupport() {
  console.log('🔍 Checking Li.Fi Solana Support...\n');
  
  // Try getting a quote for a Solana swap
  console.log('Testing SOL → USDC quote request...');
  
  try {
    // Try with string chain ID (from docs)
    const quoteRes = await fetch('https://li.quest/v1/quote?' + new URLSearchParams({
      fromChain: '1151111081099710', // Solana chain ID from docs
      toChain: '1151111081099710',
      fromToken: 'So11111111111111111111111111111111111111112', // SOL
      toToken: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
      fromAmount: '1000000000', // 1 SOL (9 decimals)
      fromAddress: 'TestAddressTestAddressTestAddress',
      slippage: 0.01
    }), {
      headers: { 'x-lifi-api-key': LIFI_API_KEY }
    });
    
    const quoteData = await quoteRes.json();
    
    if (quoteRes.ok) {
      console.log('✅ Quote successful!');
      console.log('Tool:', quoteData.tool);
      console.log('Estimate:', quoteData.estimate);
    } else {
      console.log('❌ Quote failed:', quoteRes.status);
      console.log('Error:', JSON.stringify(quoteData, null, 2));
    }
  } catch (error) {
    console.log('❌ Request failed:', error.message);
  }
  
  console.log('\n');
  console.log('Checking documentation claim about Solana...');
  console.log('According to https://docs.li.fi/, Solana should use chain ID: 1151111081099710');
  console.log('But /chains endpoint only returns EVM chains.');
  console.log('\n⚠️  This might mean:');
  console.log('1. Solana is supported via quote/routes but not listed in /chains');
  console.log('2. Solana support is limited or in beta');
  console.log('3. We need to use Jupiter API directly for Solana swaps');
}

checkSolanaSupport().catch(console.error);
