/**
 * Test CoinGecko PAID API for all chains
 * This should have NO rate limiting!
 */

const https = require('https');
require('dotenv').config({ path: '.env.local' });

const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY?.trim().replace(/\\n/g, '');

if (!COINGECKO_API_KEY) {
  console.error('❌ COINGECKO_API_KEY not found in .env.local');
  process.exit(1);
}

console.log(`✅ Using CoinGecko API Key: ${COINGECKO_API_KEY.substring(0, 10)}...`);

// Test tokens from each chain
const TEST_TOKENS_BY_CHAIN = {
  ethereum: [
    { symbol: 'PENDLE', address: '0x808507121b80c02388fad14726482e061b8da827' },
    { symbol: 'SHIB', address: '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce' },
  ],
  polygon: [
    { symbol: 'WMATIC', address: '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270' },
    { symbol: 'QUICK', address: '0xb5c064f955d8e7f38fe0460c556a72987494ee17' },
  ],
  arbitrum: [
    { symbol: 'ARB', address: '0x912ce59144191c1204e64559fe8253a0e49e6548' },
    { symbol: 'GMX', address: '0xfc5a1a6eb076a2c7ad06ed22c90d7e710e35ad0a' },
  ],
  base: [
    { symbol: 'BRETT', address: '0x532f27101965dd16442e59d40670faf5ebb142e4' },
    { symbol: 'DEGEN', address: '0x4ed4e862860bed51a9570b96d89af5e1b0efefed' },
  ],
  optimism: [
    { symbol: 'OP', address: '0x4200000000000000000000000000000000000042' },
    { symbol: 'VELO', address: '0x3c8b650257cfb5f272f799f5e2b4e65093a11a05' },
  ],
  bsc: [
    { symbol: 'CAKE', address: '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82' },
    { symbol: 'BAKE', address: '0xe02df9e3e622debdd69fb838bb799e3f168902c5' },
  ],
  avalanche: [
    { symbol: 'JOE', address: '0x6e84a6216ea6dacc71ee8e6b0a5b7322eebc0fdd' },
    { symbol: 'PNG', address: '0x60781c2586d68229fde47564546784ab3faca982' },
  ],
  solana: [
    { symbol: '$CWIF', address: 'CvRWP8s3X1s2tTjstPt9sHfj7bvEpf2v7PeyVMTzN6F9' },
    { symbol: 'ai16z', address: 'HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC' },
    { symbol: 'SLERF', address: '7BgBvyjrZX1YKz4oh9mjb8ZScatkkwb8DzFx7LoiVkM3' },
  ],
};

const PLATFORM_IDS = {
  ethereum: 'ethereum',
  polygon: 'polygon-pos',
  arbitrum: 'arbitrum-one',
  base: 'base',
  optimism: 'optimistic-ethereum',
  bsc: 'binance-smart-chain',
  avalanche: 'avalanche',
  solana: 'solana',
};

function fetch(url, useApiKey = true) {
  return new Promise((resolve) => {
    // ✅ FIX: Pro API key requires pro-api.coingecko.com domain!
    let requestUrl = url;
    if (useApiKey && url.includes('api.coingecko.com')) {
      requestUrl = url.replace('api.coingecko.com', 'pro-api.coingecko.com');
      requestUrl = `${requestUrl}${requestUrl.includes('?') ? '&' : '?'}x_cg_pro_api_key=${COINGECKO_API_KEY}`;
    }

    https.get(requestUrl, {
      headers: {
        'User-Agent': 'BlazeWallet/1.0 (https://blazewallet.com)',
        'Accept': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            resolve({ ok: true, data: JSON.parse(data), status: res.statusCode });
          } catch {
            resolve({ ok: true, data, status: res.statusCode });
          }
        } else {
          resolve({ ok: false, status: res.statusCode, data });
        }
      });
    }).on('error', (error) => {
      resolve({ ok: false, error: error.message });
    }).setTimeout(5000, function() {
      this.destroy();
      resolve({ ok: false, error: 'Timeout' });
    });
  });
}

async function checkImageUrl(url) {
  try {
    return new Promise((resolve) => {
      https.request(url, { method: 'HEAD' }, (res) => {
        resolve(res.statusCode === 200);
      }).on('error', () => resolve(false)).setTimeout(3000, function() {
        this.destroy();
        resolve(false);
      }).end();
    });
  } catch {
    return false;
  }
}

async function testToken(chainKey, token) {
  const platformId = PLATFORM_IDS[chainKey];
  const results = [];

  // Method 1: Contract address
  try {
    const contractUrl = `https://api.coingecko.com/api/v3/coins/${platformId}/contract/${token.address}`;
    const response = await fetch(contractUrl, true);
    
    if (response.ok && response.data && response.data.image) {
      const logoUrl = response.data.image.large || response.data.image.small || response.data.image.thumb;
      if (logoUrl) {
        const accessible = await checkImageUrl(logoUrl);
        results.push({
          method: 'Contract API',
          url: logoUrl,
          accessible,
          coinId: response.data.id
        });
      }
    }
  } catch (error) {
    // Silent fail
  }

  // Method 2: Search API
  try {
    const searchUrl = `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(token.symbol)}`;
    const response = await fetch(searchUrl, true);
    
    if (response.ok && response.data && response.data.coins && response.data.coins.length > 0) {
      const matchingCoin = response.data.coins.find(c => 
        c.platforms && c.platforms[platformId]?.toLowerCase() === token.address.toLowerCase()
      );
      
      const coin = matchingCoin || response.data.coins[0];
      const logoUrl = coin.large || coin.thumb;
      
      if (logoUrl) {
        const accessible = await checkImageUrl(logoUrl);
        results.push({
          method: 'Search API',
          url: logoUrl,
          accessible,
          exactMatch: !!matchingCoin,
          coinId: coin.id
        });
      }
    }
  } catch (error) {
    // Silent fail
  }

  return results;
}

async function testChain(chainKey, tokens) {
  console.log(`\n${'═'.repeat(80)}`);
  console.log(`🔗 CHAIN: ${chainKey.toUpperCase()}`);
  console.log(`📋 Testing ${tokens.length} tokens with PAID API`);
  console.log('═'.repeat(80));

  const chainResults = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    console.log(`\n[${i + 1}/${tokens.length}] Testing ${token.symbol}...`);

    const results = await testToken(chainKey, token);

    if (results.length > 0) {
      console.log(`    ✅ Found ${results.length} working method(s)`);
      results.forEach((r, idx) => {
        console.log(`       ${idx + 1}. ${r.method}`);
        console.log(`          Coin ID: ${r.coinId}`);
        console.log(`          URL: ${r.url.substring(0, 70)}...`);
        console.log(`          Accessible: ${r.accessible ? 'YES ✅' : 'NO ❌'}`);
        if (r.exactMatch !== undefined) {
          console.log(`          Exact Match: ${r.exactMatch ? 'YES ✅' : 'NO'}`);
        }
      });
    } else {
      console.log(`    ❌ No working methods found`);
    }

    chainResults.push({
      token: token.symbol,
      results
    });

    // Smaller delay with paid API
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return {
    chain: chainKey,
    totalTokens: tokens.length,
    successfulTokens: chainResults.filter(r => r.results.length > 0).length,
    results: chainResults
  };
}

async function main() {
  console.log('╔' + '═'.repeat(78) + '╗');
  console.log('║' + ' '.repeat(20) + 'COINGECKO PAID API TEST' + ' '.repeat(33) + '║');
  console.log('╚' + '═'.repeat(78) + '╝');
  console.log('\n🎯 Testing with PAID CoinGecko API (no rate limits!)');

  const allChainResults = [];

  for (const [chainKey, tokens] of Object.entries(TEST_TOKENS_BY_CHAIN)) {
    const chainResult = await testChain(chainKey, tokens);
    allChainResults.push(chainResult);
  }

  // Final Summary
  console.log('\n\n╔' + '═'.repeat(78) + '╗');
  console.log('║' + ' '.repeat(30) + 'FINAL RESULTS' + ' '.repeat(35) + '║');
  console.log('╚' + '═'.repeat(78) + '╝');

  let totalTokens = 0;
  let totalSuccessful = 0;

  allChainResults.forEach(chainResult => {
    totalTokens += chainResult.totalTokens;
    totalSuccessful += chainResult.successfulTokens;

    const successRate = ((chainResult.successfulTokens / chainResult.totalTokens) * 100).toFixed(0);
    const status = chainResult.successfulTokens === chainResult.totalTokens ? '✅' : 
                   chainResult.successfulTokens > 0 ? '⚠️' : '❌';

    console.log(`\n${status} ${chainResult.chain.toUpperCase().padEnd(15)} ${chainResult.successfulTokens}/${chainResult.totalTokens} tokens (${successRate}%)`);

    const failedTokens = chainResult.results.filter(r => r.results.length === 0);
    if (failedTokens.length > 0) {
      console.log(`   ❌ Failed: ${failedTokens.map(t => t.token).join(', ')}`);
    }
  });

  const overallSuccessRate = ((totalSuccessful / totalTokens) * 100).toFixed(1);

  console.log('\n' + '─'.repeat(80));
  console.log(`📊 OVERALL: ${totalSuccessful}/${totalTokens} tokens (${overallSuccessRate}%)`);
  console.log('─'.repeat(80));

  if (overallSuccessRate >= 90) {
    console.log('\n✅ EXCELLENT! Paid CoinGecko API works great!');
    console.log('💡 RECOMMENDATION: Implement this in the wallet.');
  } else if (overallSuccessRate >= 70) {
    console.log('\n⚠️ GOOD: Works for most tokens.');
    console.log('💡 RECOMMENDATION: Implement with fallback for missing tokens.');
  } else {
    console.log('\n❌ Still need additional sources for coverage.');
  }

  console.log('\n✨ Testing complete!\n');
}

main().catch(console.error);

