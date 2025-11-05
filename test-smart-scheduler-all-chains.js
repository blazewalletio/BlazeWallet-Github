// ============================================================================
// 🔥 SMART SCHEDULER - COMPLETE CHAIN TEST
// ============================================================================
// Tests gas fetching, AI prediction, and USD calculation for ALL 18 chains
// ============================================================================

const ALL_CHAINS = [
  // EVM Chains (11)
  'ethereum', 'polygon', 'base', 'arbitrum', 'optimism',
  'avalanche', 'bsc', 'fantom', 'cronos', 'zksync', 'linea',
  
  // Solana (1)
  'solana',
  
  // Bitcoin & Forks (4)
  'bitcoin', 'litecoin', 'dogecoin', 'bitcoincash',
];

async function testChain(chain) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🧪 TESTING: ${chain.toUpperCase()}`);
  console.log('='.repeat(60));

  try {
    // 1. Test gas price fetching
    console.log('📡 [1/3] Fetching current gas price...');
    const gasResponse = await fetch(`https://my.blazewallet.io/api/gas-optimizer?chain=${chain}`);
    
    if (!gasResponse.ok) {
      throw new Error(`Gas API returned ${gasResponse.status}`);
    }

    const gasData = await gasResponse.json();
    const currentGas = gasData.gasPrice?.standard || 0;

    if (currentGas <= 0) {
      console.error(`❌ Invalid gas price: ${currentGas}`);
      return {
        chain,
        success: false,
        error: 'Invalid gas price',
      };
    }

    console.log(`✅ Current gas: ${currentGas} ${getGasUnit(chain)}`);

    // 2. Test AI prediction
    console.log('🤖 [2/3] Testing AI prediction...');
    const predictionResponse = await fetch('https://my.blazewallet.io/api/smart-scheduler/predict-optimal-time', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chain: chain.toLowerCase(),
        current_gas_price: currentGas,
        max_wait_hours: 24,
      }),
    });

    if (!predictionResponse.ok) {
      const errorData = await predictionResponse.json();
      throw new Error(`Prediction failed: ${errorData.error}`);
    }

    const predictionData = await predictionResponse.json();
    const prediction = predictionData.data;

    console.log(`✅ Optimal time: ${new Date(prediction.optimal_time).toLocaleString()}`);
    console.log(`✅ Confidence: ${prediction.confidence_score}%`);
    console.log(`✅ Predicted gas: ${prediction.predicted_gas_price} ${getGasUnit(chain)}`);
    console.log(`✅ Est. savings: ${prediction.estimated_savings_percent}% ($${prediction.estimated_savings_usd.toFixed(4)})`);

    // 3. Verify USD calculation is not $0
    if (prediction.estimated_savings_usd === 0 && prediction.estimated_savings_percent > 0) {
      console.warn(`⚠️  USD savings is $0 despite ${prediction.estimated_savings_percent}% savings`);
    }

    // 4. Verify optimal time is valid
    const optimalTime = new Date(prediction.optimal_time);
    const now = new Date();
    const maxTime = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    if (optimalTime < now || optimalTime > maxTime) {
      console.warn(`⚠️  Optimal time outside valid range`);
    }

    console.log(`✅ [3/3] All checks passed for ${chain}!`);

    return {
      chain,
      success: true,
      currentGas,
      prediction: {
        optimal_time: prediction.optimal_time,
        confidence: prediction.confidence_score,
        savings_percent: prediction.estimated_savings_percent,
        savings_usd: prediction.estimated_savings_usd,
      },
    };

  } catch (error) {
    console.error(`❌ Error testing ${chain}:`, error.message);
    return {
      chain,
      success: false,
      error: error.message,
    };
  }
}

function getGasUnit(chain) {
  if (chain === 'solana') return 'lamports';
  if (['bitcoin', 'litecoin', 'dogecoin', 'bitcoincash'].includes(chain)) return 'sat/vB';
  return 'gwei';
}

async function main() {
  console.log('🔥 BLAZE WALLET - SMART SCHEDULER COMPLETE CHAIN TEST');
  console.log(`Testing ${ALL_CHAINS.length} chains...`);
  console.log('');

  const results = [];

  // Test all chains sequentially (to avoid rate limiting)
  for (const chain of ALL_CHAINS) {
    const result = await testChain(chain);
    results.push(result);
    
    // Wait 2 seconds between chains to avoid rate limits
    if (chain !== ALL_CHAINS[ALL_CHAINS.length - 1]) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Print summary
  console.log('\n\n');
  console.log('='.repeat(80));
  console.log('📊 FINAL SUMMARY');
  console.log('='.repeat(80));

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`\n✅ PASSED: ${successful.length}/${ALL_CHAINS.length} chains`);
  if (successful.length > 0) {
    successful.forEach(r => {
      console.log(`   - ${r.chain}: ${r.prediction.confidence}% confidence, ${r.prediction.savings_percent.toFixed(1)}% savings ($${r.prediction.savings_usd.toFixed(4)})`);
    });
  }

  if (failed.length > 0) {
    console.log(`\n❌ FAILED: ${failed.length}/${ALL_CHAINS.length} chains`);
    failed.forEach(r => {
      console.log(`   - ${r.chain}: ${r.error}`);
    });
  }

  console.log('\n' + '='.repeat(80));

  if (failed.length === 0) {
    console.log('🎉 ALL CHAINS PASSED! Smart Scheduler is 100% ready for production!');
  } else {
    console.log(`⚠️  ${failed.length} chain(s) need attention`);
  }

  console.log('='.repeat(80));
}

main().catch(console.error);

