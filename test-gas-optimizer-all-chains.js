#!/usr/bin/env node

/**
 * 🔥 COMPREHENSIVE GAS OPTIMIZER TEST
 * 
 * Tests all 18 supported chains for:
 * - Real-time gas price fetching
 * - USD cost calculations
 * - API availability
 * - Error handling
 * 
 * Run: node test-gas-optimizer-all-chains.js
 */

const chains = [
  // EVM Chains (11)
  { name: 'ethereum', type: 'evm', nativeCurrency: 'ETH' },
  { name: 'polygon', type: 'evm', nativeCurrency: 'MATIC' },
  { name: 'arbitrum', type: 'evm', nativeCurrency: 'ETH' },
  { name: 'optimism', type: 'evm', nativeCurrency: 'ETH' },
  { name: 'base', type: 'evm', nativeCurrency: 'ETH' },
  { name: 'avalanche', type: 'evm', nativeCurrency: 'AVAX' },
  { name: 'bsc', type: 'evm', nativeCurrency: 'BNB' },
  { name: 'fantom', type: 'evm', nativeCurrency: 'FTM' },
  { name: 'cronos', type: 'evm', nativeCurrency: 'CRO' },
  { name: 'zksync', type: 'evm', nativeCurrency: 'ETH' },
  { name: 'linea', type: 'evm', nativeCurrency: 'ETH' },
  
  // Bitcoin-like Chains (4)
  { name: 'bitcoin', type: 'bitcoin', nativeCurrency: 'BTC' },
  { name: 'litecoin', type: 'bitcoin', nativeCurrency: 'LTC' },
  { name: 'dogecoin', type: 'bitcoin', nativeCurrency: 'DOGE' },
  { name: 'bitcoincash', type: 'bitcoin', nativeCurrency: 'BCH' },
  
  // Solana (1)
  { name: 'solana', type: 'solana', nativeCurrency: 'SOL' },
];

async function testChain(chain) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔍 TESTING: ${chain.name.toUpperCase()} (${chain.type})`);
  console.log(`${'='.repeat(60)}`);
  
  try {
    // Step 1: Test gas price API
    console.log('\n📊 Step 1: Fetching gas price...');
    const gasResponse = await fetch(`http://localhost:3000/api/gas-optimizer?chain=${chain.name}`);
    
    if (!gasResponse.ok) {
      throw new Error(`Gas API returned ${gasResponse.status}`);
    }
    
    const gasData = await gasResponse.json();
    
    if (!gasData.success) {
      throw new Error(`Gas API failed: ${gasData.error}`);
    }
    
    const gasPrice = gasData.gasPrice;
    
    console.log(`✅ Gas Price: ${gasPrice.gasPrice.toFixed(2)} (${gasPrice.source})`);
    console.log(`   Slow:     ${gasPrice.slow.toFixed(2)}`);
    console.log(`   Standard: ${gasPrice.standard.toFixed(2)}`);
    console.log(`   Fast:     ${gasPrice.fast.toFixed(2)}`);
    console.log(`   Instant:  ${gasPrice.instant.toFixed(2)}`);
    
    // Step 2: Test full AI analysis
    console.log('\n🤖 Step 2: Testing AI analysis...');
    const analysisResponse = await fetch('http://localhost:3000/api/gas-optimizer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chain: chain.name,
        transactionType: 'transfer',
        urgency: 'medium',
      }),
    });
    
    if (!analysisResponse.ok) {
      throw new Error(`Analysis API returned ${analysisResponse.status}`);
    }
    
    const analysisData = await analysisResponse.json();
    
    if (!analysisData.success) {
      throw new Error(`Analysis API failed: ${analysisData.error}`);
    }
    
    const analysis = analysisData.analysis;
    
    console.log(`✅ Current Gas: ${analysis.currentGas.price.toFixed(2)} (${analysis.currentGas.level})`);
    console.log(`✅ USD Costs:`);
    console.log(`   Transfer: $${analysis.currentGas.usdCost.transfer.toFixed(4)}`);
    console.log(`   Swap:     $${analysis.currentGas.usdCost.swap.toFixed(4)}`);
    console.log(`   Contract: $${analysis.currentGas.usdCost.contract.toFixed(4)}`);
    
    console.log(`✅ Historical:`);
    console.log(`   24h Avg:  ${analysis.historical.avg24h.toFixed(2)}`);
    console.log(`   24h Min:  ${analysis.historical.min24h.toFixed(2)}`);
    console.log(`   24h Max:  ${analysis.historical.max24h.toFixed(2)}`);
    console.log(`   Percentile: ${analysis.historical.percentile.toFixed(1)}%`);
    
    console.log(`✅ AI Recommendation:`);
    console.log(`   Action:     ${analysis.recommendation.action}`);
    console.log(`   Confidence: ${analysis.recommendation.confidence}%`);
    console.log(`   Reasoning:  ${analysis.recommendation.reasoning}`);
    
    if (analysis.recommendation.estimatedSavings) {
      console.log(`   Savings:    $${analysis.recommendation.estimatedSavings.usd.toFixed(4)} (${analysis.recommendation.estimatedSavings.percentage.toFixed(1)}%)`);
    }
    
    // Step 3: Validate USD costs
    console.log('\n💰 Step 3: Validating USD calculations...');
    
    if (chain.type === 'evm') {
      // EVM: Should have transfer + swap + contract
      if (analysis.currentGas.usdCost.transfer <= 0) {
        throw new Error('❌ Transfer cost should be > 0 for EVM');
      }
      if (analysis.currentGas.usdCost.swap <= 0) {
        throw new Error('❌ Swap cost should be > 0 for EVM');
      }
      if (analysis.currentGas.usdCost.contract <= 0) {
        throw new Error('❌ Contract cost should be > 0 for EVM');
      }
      console.log('✅ EVM costs validated');
    } else if (chain.type === 'bitcoin') {
      // Bitcoin: Should have transfer only
      if (analysis.currentGas.usdCost.transfer <= 0) {
        throw new Error('❌ Transfer cost should be > 0 for Bitcoin');
      }
      if (analysis.currentGas.usdCost.swap !== 0) {
        throw new Error('❌ Swap cost should be 0 for Bitcoin');
      }
      if (analysis.currentGas.usdCost.contract !== 0) {
        throw new Error('❌ Contract cost should be 0 for Bitcoin');
      }
      console.log('✅ Bitcoin costs validated');
    } else if (chain.type === 'solana') {
      // Solana: Should have all three
      if (analysis.currentGas.usdCost.transfer <= 0) {
        throw new Error('❌ Transfer cost should be > 0 for Solana');
      }
      if (analysis.currentGas.usdCost.swap <= 0) {
        throw new Error('❌ Swap cost should be > 0 for Solana');
      }
      if (analysis.currentGas.usdCost.contract <= 0) {
        throw new Error('❌ Contract cost should be > 0 for Solana');
      }
      console.log('✅ Solana costs validated');
    }
    
    console.log(`\n✅✅✅ ${chain.name.toUpperCase()} - ALL TESTS PASSED! ✅✅✅`);
    
    return { chain: chain.name, success: true };
    
  } catch (error) {
    console.error(`\n❌❌❌ ${chain.name.toUpperCase()} - TEST FAILED! ❌❌❌`);
    console.error(`Error: ${error.message}`);
    
    return { chain: chain.name, success: false, error: error.message };
  }
}

async function runAllTests() {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║  🔥 BLAZE WALLET - GAS OPTIMIZER COMPREHENSIVE TEST       ║
║  Testing all ${chains.length} supported chains                           ║
╚════════════════════════════════════════════════════════════╝
`);
  
  const results = [];
  
  for (const chain of chains) {
    const result = await testChain(chain);
    results.push(result);
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Summary
  console.log(`\n\n${'='.repeat(60)}`);
  console.log(`📊 FINAL SUMMARY`);
  console.log(`${'='.repeat(60)}\n`);
  
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`✅ PASSED: ${passed}/${chains.length}`);
  console.log(`❌ FAILED: ${failed}/${chains.length}`);
  
  if (failed > 0) {
    console.log('\n❌ Failed chains:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`   - ${r.chain}: ${r.error}`);
    });
  }
  
  console.log('\n✅ Passed chains:');
  results.filter(r => r.success).forEach(r => {
    console.log(`   - ${r.chain}`);
  });
  
  if (failed === 0) {
    console.log(`\n🎉🎉🎉 ALL ${chains.length} CHAINS WORKING PERFECTLY! 🎉🎉🎉\n`);
    process.exit(0);
  } else {
    console.log(`\n⚠️  ${failed} chain(s) need attention.\n`);
    process.exit(1);
  }
}

// Check if server is running
async function checkServer() {
  try {
    const response = await fetch('http://localhost:3000/api/gas-optimizer?chain=ethereum');
    if (!response.ok) {
      throw new Error('Server not responding');
    }
  } catch (error) {
    console.error('\n❌ ERROR: Development server not running!');
    console.error('Please start the server first:');
    console.error('  npm run dev\n');
    process.exit(1);
  }
}

// Run tests
checkServer().then(() => runAllTests());

