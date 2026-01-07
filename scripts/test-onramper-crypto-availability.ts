/**
 * Test script to determine which cryptocurrencies are actually available
 * for each chain via Onramper API
 * 
 * This tests all 18 chains and checks which crypto's have actual quotes available
 */

import 'dotenv/config';
import { CHAINS } from '../lib/chains';
import { OnramperService } from '../lib/onramper-service';

interface TestResult {
  chain: string;
  chainId: number;
  networkCode: string;
  testedCryptos: string[];
  availableCryptos: string[];
  unavailableCryptos: { crypto: string; reason: string }[];
}

const ONRAMPER_API_KEY = process.env.ONRAMPER_API_KEY?.trim().replace(/^["']|["']$/g, '') || '';

async function testCryptoAvailability(
  chainId: number,
  networkCode: string,
  crypto: string,
  fiatCurrency: string = 'EUR',
  fiatAmount: number = 250
): Promise<{ available: boolean; reason?: string; providerCount?: number }> {
  try {
    const url = `https://api.onramper.com/quotes?apiKey=${ONRAMPER_API_KEY}&fiatAmount=${fiatAmount}&fiatCurrency=${fiatCurrency}&cryptoCurrency=${crypto}&network=${networkCode}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': ONRAMPER_API_KEY,
      },
    });

    if (!response.ok) {
      return {
        available: false,
        reason: `API error: ${response.status} ${response.statusText}`,
      };
    }

    const data = await response.json();
    
    if (!data.success) {
      return {
        available: false,
        reason: data.error || data.message || 'Unknown error',
      };
    }

    const quotes = data.quotes || [];
    const validQuotes = quotes.filter((q: any) => 
      !q.errors || q.errors.length === 0 || 
      (q.payout && parseFloat(q.payout.toString()) > 0)
    );

    if (validQuotes.length > 0) {
      return {
        available: true,
        providerCount: validQuotes.length,
      };
    }

    return {
      available: false,
      reason: 'No valid quotes from any provider',
      providerCount: quotes.length,
    };
  } catch (error: any) {
    return {
      available: false,
      reason: `Network error: ${error.message}`,
    };
  }
}

async function testChain(chainKey: string, chain: any): Promise<TestResult> {
  console.log(`\n🔍 Testing chain: ${chain.name} (ID: ${chain.id})`);
  
  const networkCode = OnramperService.getNetworkCode(chain.id);
  const supportedAssets = OnramperService.getSupportedAssets(chain.id);
  
  // Also test common crypto's that might be available
  const commonCryptos = ['ETH', 'USDT', 'USDC', 'BTC', 'SOL', 'MATIC', 'BNB', 'AVAX', 'DAI', 'WBTC', 'LINK', 'UNI', 'AAVE', 'BUSD'];
  
  // Combine supported assets with common cryptos, remove duplicates
  const cryptosToTest = Array.from(new Set([
    ...supportedAssets,
    ...commonCryptos,
    chain.nativeCurrency?.symbol || '',
  ])).filter(Boolean);

  console.log(`   Testing ${cryptosToTest.length} crypto currencies...`);

  const availableCryptos: string[] = [];
  const unavailableCryptos: { crypto: string; reason: string }[] = [];

  for (const crypto of cryptosToTest) {
    console.log(`   Testing ${crypto}...`);
    const result = await testCryptoAvailability(chain.id, networkCode, crypto);
    
    if (result.available) {
      availableCryptos.push(crypto);
      console.log(`   ✅ ${crypto}: Available (${result.providerCount} providers)`);
    } else {
      unavailableCryptos.push({
        crypto,
        reason: result.reason || 'Unknown',
      });
      console.log(`   ❌ ${crypto}: ${result.reason}`);
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return {
    chain: chainKey,
    chainId: chain.id,
    networkCode,
    testedCryptos: cryptosToTest,
    availableCryptos,
    unavailableCryptos,
  };
}

async function main() {
  if (!ONRAMPER_API_KEY) {
    console.error('❌ ONRAMPER_API_KEY not found in environment variables');
    process.exit(1);
  }

  console.log('🚀 Starting Onramper Crypto Availability Test');
  console.log(`📊 Testing ${Object.keys(CHAINS).length} chains\n`);

  const results: TestResult[] = [];

  // Test all chains
  for (const [chainKey, chain] of Object.entries(CHAINS)) {
    // Skip testnets for now
    if (chain.isTestnet) {
      console.log(`⏭️  Skipping testnet: ${chain.name}`);
      continue;
    }

    try {
      const result = await testChain(chainKey, chain);
      results.push(result);
    } catch (error: any) {
      console.error(`❌ Error testing ${chain.name}:`, error.message);
      results.push({
        chain: chainKey,
        chainId: chain.id,
        networkCode: OnramperService.getNetworkCode(chain.id),
        testedCryptos: [],
        availableCryptos: [],
        unavailableCryptos: [{ crypto: 'ALL', reason: error.message }],
      });
    }

    // Delay between chains
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Print summary
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 SUMMARY - Available Cryptocurrencies per Chain');
  console.log('='.repeat(80));

  for (const result of results) {
    const chain = CHAINS[result.chain];
    console.log(`\n${chain.name} (${result.networkCode}):`);
    if (result.availableCryptos.length > 0) {
      console.log(`  ✅ Available: ${result.availableCryptos.join(', ')}`);
    } else {
      console.log(`  ❌ No available cryptocurrencies`);
    }
    if (result.unavailableCryptos.length > 0 && result.unavailableCryptos.length < 10) {
      console.log(`  ❌ Unavailable: ${result.unavailableCryptos.map(u => u.crypto).join(', ')}`);
    }
  }

  // Generate code suggestion
  console.log('\n\n' + '='.repeat(80));
  console.log('💡 SUGGESTED CODE UPDATE for getSupportedAssets()');
  console.log('='.repeat(80));
  console.log('\nstatic getSupportedAssets(chainId: number): string[] {');
  console.log('  const assetMap: Record<number, string[]> = {');
  
  for (const result of results) {
    if (result.availableCryptos.length > 0) {
      const cryptos = result.availableCryptos.map(c => `'${c}'`).join(', ');
      console.log(`    ${result.chainId}: [${cryptos}], // ${CHAINS[result.chain].name}`);
    }
  }
  
  console.log('  };');
  console.log('  return assetMap[chainId] || [];');
  console.log('}');

  // Save results to file
  const fs = require('fs');
  const outputPath = 'test-results-crypto-availability.json';
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n✅ Results saved to ${outputPath}`);
}

main().catch(console.error);

