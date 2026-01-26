const LIFI_API_KEY = '02dff428-23bb-4731-b449-89f63892353a.d0967ed5-1aec-4c87-992a-564b56b7c295';

async function testSolanaQuote() {
  console.log('🧪 Testing Solana Quote...\n');
  
  // Use a valid Solana address (43-44 chars, Base58)
  const testAddress = '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr';
  
  const params = {
    fromChain: '1151111081099710',
    toChain: '1151111081099710',
    fromToken: 'So11111111111111111111111111111111111111112',
    toToken: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    fromAmount: '100000000',
    fromAddress: testAddress,
    slippage: '0.01'
  };
  
  console.log('Testing SOL → USDC swap...');
  console.log('');
  
  try {
    const url = 'https://li.quest/v1/quote?' + new URLSearchParams(params);
    const response = await fetch(url, {
      headers: { 'x-lifi-api-key': LIFI_API_KEY }
    });
    
    const data = await response.json();
    
    console.log(`Status: ${response.status}`);
    
    if (response.ok) {
      console.log('✅ Solana swap SUPPORTED!');
      console.log('Tool/DEX:', data.tool || data.toolDetails?.name);
      console.log('Estimate:', data.estimate ? 'Available' : 'N/A');
    } else {
      console.log('❌ Failed:', data.message || 'Unknown error');
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
  
  console.log('\n📊 CONCLUSION:');
  console.log('Li.Fi MAY support Solana via /quote endpoint');
  console.log('But it\'s NOT in /chains endpoint');
  console.log('We should use Jupiter API directly for Solana swaps');
}

testSolanaQuote().catch(console.error);
