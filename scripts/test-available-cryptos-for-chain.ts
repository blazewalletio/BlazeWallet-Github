/**
 * Test script to determine which cryptocurrencies are actually available
 * for a specific chain by testing quotes for each crypto
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const ONRAMPER_API_KEY = process.env.ONRAMPER_API_KEY?.trim().replace(/^["']|["']$/g, '');

if (!ONRAMPER_API_KEY) {
  console.error('❌ ONRAMPER_API_KEY not found in environment variables');
  process.exit(1);
}

// Chain configurations
const CHAINS = {
  solana: { id: 101, name: 'Solana', network: 'solana' },
  ethereum: { id: 1, name: 'Ethereum', network: 'ethereum' },
  polygon: { id: 137, name: 'Polygon', network: 'polygon' },
  bsc: { id: 56, name: 'BSC', network: 'bsc' },
  arbitrum: { id: 42161, name: 'Arbitrum', network: 'arbitrum' },
  base: { id: 8453, name: 'Base', network: 'base' },
  avalanche: { id: 43114, name: 'Avalanche', network: 'avalanche' },
};

// Potential cryptos to test (from Onramper's supported list)
const CRYPTOS_TO_TEST = ['ETH', 'USDT', 'USDC', 'BTC', 'SOL', 'MATIC', 'BNB', 'AVAX', 'DAI', 'WBTC', 'LINK', 'UNI', 'AAVE', 'BUSD'];

async function testCryptoAvailability(chainKey: string, crypto: string): Promise<boolean> {
  const chain = CHAINS[chainKey as keyof typeof CHAINS];
  if (!chain) {
    console.error(`❌ Unknown chain: ${chainKey}`);
    return false;
  }

  try {
    // Test with a small amount (100 EUR) to see if quotes are available
    const url = `https://api.onramper.com/quotes/eur/${crypto.toLowerCase()}?amount=100`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': ONRAMPER_API_KEY,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        // 404 means crypto not supported
        return false;
      }
      // Other errors might be temporary
      const errorText = await response.text();
      console.log(`⚠️  ${crypto} on ${chain.name}: ${response.status} - ${errorText.substring(0, 100)}`);
      return false;
    }

    const data = await response.json();
    
    // Check if we got valid quotes
    if (Array.isArray(data) && data.length > 0) {
      // Check if any provider has a valid quote (with payout/rate)
      const hasValidQuote = data.some((quote: any) => {
        return quote.payout && parseFloat(quote.payout.toString()) > 0;
      });
      
      if (hasValidQuote) {
        console.log(`✅ ${crypto} on ${chain.name}: Available (${data.length} providers)`);
        return true;
      } else {
        console.log(`⚠️  ${crypto} on ${chain.name}: No valid quotes (${data.length} providers, but no payout)`);
        return false;
      }
    } else {
      console.log(`❌ ${crypto} on ${chain.name}: No quotes returned`);
      return false;
    }
  } catch (error: any) {
    console.error(`❌ Error testing ${crypto} on ${chain.name}:`, error.message);
    return false;
  }
}

async function testChain(chainKey: string) {
  console.log(`\n🔍 Testing ${CHAINS[chainKey as keyof typeof CHAINS]?.name || chainKey}...`);
  console.log('='.repeat(60));
  
  const availableCryptos: string[] = [];
  
  for (const crypto of CRYPTOS_TO_TEST) {
    // Skip cryptos that don't make sense for this chain
    const chain = CHAINS[chainKey as keyof typeof CHAINS];
    if (chain) {
      // Basic filtering: SOL only for Solana, MATIC only for Polygon, etc.
      if (chainKey === 'solana' && !['SOL', 'USDT', 'USDC'].includes(crypto)) {
        continue;
      }
      if (chainKey === 'polygon' && !['MATIC', 'USDT', 'USDC', 'ETH'].includes(crypto)) {
        continue;
      }
      if (chainKey === 'ethereum' && ['SOL', 'MATIC', 'BNB', 'AVAX'].includes(crypto)) {
        continue;
      }
      // Add more chain-specific filters as needed
    }
    
    const isAvailable = await testCryptoAvailability(chainKey, crypto);
    if (isAvailable) {
      availableCryptos.push(crypto);
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log(`\n📊 Results for ${CHAINS[chainKey as keyof typeof CHAINS]?.name || chainKey}:`);
  console.log(`Available cryptos: ${availableCryptos.length > 0 ? availableCryptos.join(', ') : 'None'}`);
  
  return availableCryptos;
}

async function main() {
  console.log('🚀 Testing cryptocurrency availability for different chains...\n');
  console.log(`API Key: ${ONRAMPER_API_KEY.substring(0, 10)}...${ONRAMPER_API_KEY.substring(ONRAMPER_API_KEY.length - 4)}\n`);
  
  // Test Solana first (most relevant based on user's issue)
  const solanaCryptos = await testChain('solana');
  
  // Test Ethereum
  const ethereumCryptos = await testChain('ethereum');
  
  console.log('\n' + '='.repeat(60));
  console.log('📋 SUMMARY:');
  console.log(`Solana: ${solanaCryptos.join(', ') || 'None'}`);
  console.log(`Ethereum: ${ethereumCryptos.join(', ') || 'None'}`);
}

main().catch(console.error);

