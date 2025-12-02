/**
 * 🔥 Li.Fi Swap Functionality - Comprehensive Test Script
 * 
 * Tests all critical swap scenarios:
 * 1. Same-chain swaps (EVM)
 * 2. Cross-chain swaps
 * 3. Native token swaps
 * 4. Token swaps
 * 5. Solana swaps
 * 6. Error handling
 */

const BASE_URL = 'http://localhost:3000'; // Change to production URL if needed
const LIFI_API_KEY = process.env.LIFI_API_KEY || '';

// Test wallet address (Ethereum format)
const TEST_WALLET_ADDRESS = '0x742d35Cc6634C0532925a3b844Bc9e7595f0aAcC';

// Chain IDs
const CHAINS = {
  ETHEREUM: 1,
  POLYGON: 137,
  ARBITRUM: 42161,
  BASE: 8453,
  BSC: 56,
  SOLANA: 101,
  AVALANCHE: 43114,
};

// Native token addresses
const NATIVE_TOKEN_EVM = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
const NATIVE_TOKEN_SOLANA = 'So11111111111111111111111111111111111111112';

// Popular token addresses (Ethereum mainnet)
const TOKENS = {
  USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0c3606eB48',
  USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
};

// Helper: Convert amount to wei
function toWei(amount, decimals = 18) {
  return (BigInt(Math.floor(parseFloat(amount) * Math.pow(10, decimals)))).toString();
}

// Helper: Convert amount to lamports (Solana)
function toLamports(amount) {
  return (BigInt(Math.floor(parseFloat(amount) * Math.pow(10, 9)))).toString();
}

// Test function
async function testQuote(testName, params) {
  console.log(`\n🧪 Testing: ${testName}`);
  console.log(`   Parameters:`, JSON.stringify(params, null, 2));
  
  try {
    const queryParams = new URLSearchParams({
      fromChain: params.fromChain.toString(),
      toChain: params.toChain.toString(),
      fromToken: params.fromToken,
      toToken: params.toToken,
      fromAmount: params.fromAmount,
      fromAddress: params.fromAddress || TEST_WALLET_ADDRESS,
      slippage: params.slippage || '0.03',
      order: params.order || 'RECOMMENDED',
    });

    const url = `${BASE_URL}/api/lifi/quote?${queryParams.toString()}`;
    console.log(`   URL: ${url.substring(0, 100)}...`);

    const response = await fetch(url);
    const data = await response.json();

    if (response.ok && data.success) {
      console.log(`   ✅ SUCCESS`);
      console.log(`   Tool: ${data.quote.tool}`);
      console.log(`   Steps: ${data.quote.steps.length}`);
      console.log(`   From: ${data.quote.action.fromAmount} ${data.quote.action.fromToken.symbol}`);
      console.log(`   To: ${data.quote.estimate.toAmount} ${data.quote.action.toToken.symbol}`);
      console.log(`   Execution Duration: ${data.quote.estimate.executionDuration}s`);
      return { success: true, quote: data.quote };
    } else {
      console.log(`   ❌ FAILED`);
      console.log(`   Error: ${data.error || 'Unknown error'}`);
      console.log(`   Details: ${data.details || 'No details'}`);
      return { success: false, error: data.error || data.details };
    }
  } catch (error) {
    console.log(`   ❌ ERROR: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Test scenarios
async function runTests() {
  console.log('🔥 Li.Fi Swap Functionality - Comprehensive Test Suite\n');
  console.log('='.repeat(80));

  const results = {
    passed: 0,
    failed: 0,
    total: 0,
  };

  // Test 1: Same-chain swap (Ethereum ETH -> USDC)
  results.total++;
  const test1 = await testQuote('Same-chain swap: ETH -> USDC (Ethereum)', {
    fromChain: CHAINS.ETHEREUM,
    toChain: CHAINS.ETHEREUM,
    fromToken: NATIVE_TOKEN_EVM,
    toToken: TOKENS.USDC,
    fromAmount: toWei('0.1', 18),
  });
  if (test1.success) results.passed++; else results.failed++;

  // Test 2: Cross-chain swap (Ethereum ETH -> Polygon MATIC)
  results.total++;
  const test2 = await testQuote('Cross-chain swap: ETH -> MATIC (Ethereum -> Polygon)', {
    fromChain: CHAINS.ETHEREUM,
    toChain: CHAINS.POLYGON,
    fromToken: NATIVE_TOKEN_EVM,
    toToken: NATIVE_TOKEN_EVM,
    fromAmount: toWei('0.1', 18),
  });
  if (test2.success) results.passed++; else results.failed++;

  // Test 3: Cross-chain token swap (Ethereum USDC -> Polygon USDC)
  results.total++;
  const test3 = await testQuote('Cross-chain token swap: USDC -> USDC (Ethereum -> Polygon)', {
    fromChain: CHAINS.ETHEREUM,
    toChain: CHAINS.POLYGON,
    fromToken: TOKENS.USDC,
    toToken: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // Polygon USDC
    fromAmount: toWei('100', 6), // USDC has 6 decimals
  });
  if (test3.success) results.passed++; else results.failed++;

  // Test 4: Polygon native swap (MATIC -> USDC)
  results.total++;
  const test4 = await testQuote('Same-chain swap: MATIC -> USDC (Polygon)', {
    fromChain: CHAINS.POLYGON,
    toChain: CHAINS.POLYGON,
    fromToken: NATIVE_TOKEN_EVM,
    toToken: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // Polygon USDC
    fromAmount: toWei('10', 18),
  });
  if (test4.success) results.passed++; else results.failed++;

  // Test 5: Arbitrum swap (ETH -> USDC)
  results.total++;
  const test5 = await testQuote('Same-chain swap: ETH -> USDC (Arbitrum)', {
    fromChain: CHAINS.ARBITRUM,
    toChain: CHAINS.ARBITRUM,
    fromToken: NATIVE_TOKEN_EVM,
    toToken: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8', // Arbitrum USDC
    fromAmount: toWei('0.1', 18),
  });
  if (test5.success) results.passed++; else results.failed++;

  // Test 6: Base swap (ETH -> USDC)
  results.total++;
  const test6 = await testQuote('Same-chain swap: ETH -> USDC (Base)', {
    fromChain: CHAINS.BASE,
    toChain: CHAINS.BASE,
    fromToken: NATIVE_TOKEN_EVM,
    toToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // Base USDC
    fromAmount: toWei('0.1', 18),
  });
  if (test6.success) results.passed++; else results.failed++;

  // Test 7: BSC swap (BNB -> USDT)
  results.total++;
  const test7 = await testQuote('Same-chain swap: BNB -> USDT (BSC)', {
    fromChain: CHAINS.BSC,
    toChain: CHAINS.BSC,
    fromToken: NATIVE_TOKEN_EVM,
    toToken: '0x55d398326f99059fF775485246999027B3197955', // BSC USDT
    fromAmount: toWei('0.1', 18),
  });
  if (test7.success) results.passed++; else results.failed++;

  // Test 8: Solana swap (SOL -> USDC) - May have limited support
  results.total++;
  const test8 = await testQuote('Same-chain swap: SOL -> USDC (Solana)', {
    fromChain: CHAINS.SOLANA,
    toChain: CHAINS.SOLANA,
    fromToken: NATIVE_TOKEN_SOLANA,
    toToken: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // Solana USDC
    fromAmount: toLamports('1'),
  });
  if (test8.success) results.passed++; else results.failed++;

  // Test 9: Cross-chain to Solana (Ethereum ETH -> Solana SOL)
  results.total++;
  const test9 = await testQuote('Cross-chain swap: ETH -> SOL (Ethereum -> Solana)', {
    fromChain: CHAINS.ETHEREUM,
    toChain: CHAINS.SOLANA,
    fromToken: NATIVE_TOKEN_EVM,
    toToken: NATIVE_TOKEN_SOLANA,
    fromAmount: toWei('0.1', 18),
  });
  if (test9.success) results.passed++; else results.failed++;

  // Test 10: Error case - Invalid token address
  results.total++;
  const test10 = await testQuote('Error case: Invalid token address', {
    fromChain: CHAINS.ETHEREUM,
    toChain: CHAINS.ETHEREUM,
    fromToken: NATIVE_TOKEN_EVM,
    toToken: '0x0000000000000000000000000000000000000000',
    fromAmount: toWei('0.1', 18),
  });
  // This should fail, so we check if it properly handles the error
  if (!test10.success && test10.error) {
    console.log(`   ✅ Error handling works correctly`);
    results.passed++;
  } else {
    results.failed++;
  }

  // Test 11: Error case - Missing parameters
  results.total++;
  try {
    const response = await fetch(`${BASE_URL}/api/lifi/quote?fromChain=1&toChain=1`);
    const data = await response.json();
    if (!response.ok && data.error) {
      console.log(`   ✅ Missing parameters error handling works`);
      results.passed++;
    } else {
      results.failed++;
    }
  } catch (error) {
    results.failed++;
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total Tests: ${results.total}`);
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`Success Rate: ${((results.passed / results.total) * 100).toFixed(1)}%`);
  console.log('='.repeat(80));

  return results;
}

// Run tests
if (require.main === module) {
  runTests()
    .then((results) => {
      process.exit(results.failed > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error('❌ Test suite error:', error);
      process.exit(1);
    });
}

module.exports = { runTests, testQuote };

