/**
 * DEBUG: Check exact CoinGecko API responses
 */

const https = require('https');
require('dotenv').config({ path: '.env.local' });

const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY?.trim().replace(/\\n/g, '');

console.log('API Key:', COINGECKO_API_KEY);
console.log('API Key length:', COINGECKO_API_KEY?.length);

// Test a simple known token
const testUrls = [
  // Without API key (free tier)
  'https://api.coingecko.com/api/v3/coins/ethereum/contract/0x808507121b80c02388fad14726482e061b8da827',
  // With API key (paid tier)
  `https://api.coingecko.com/api/v3/coins/ethereum/contract/0x808507121b80c02388fad14726482e061b8da827?x_cg_pro_api_key=${COINGECKO_API_KEY}`,
  // Search endpoint without key
  'https://api.coingecko.com/api/v3/search?query=PENDLE',
  // Search endpoint with key
  `https://api.coingecko.com/api/v3/search?query=PENDLE&x_cg_pro_api_key=${COINGECKO_API_KEY}`,
];

async function testUrl(url, label) {
  return new Promise((resolve) => {
    console.log(`\n${'═'.repeat(80)}`);
    console.log(`🔍 ${label}`);
    console.log(`📡 ${url.substring(0, 100)}...`);
    console.log('─'.repeat(80));

    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BlazeWallet/1.0)',
        'Accept': 'application/json'
      }
    }, (res) => {
      console.log(`Status: ${res.statusCode}`);
      console.log(`Headers:`, res.headers);
      
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const parsed = JSON.parse(data);
            console.log('✅ SUCCESS!');
            if (parsed.image) {
              console.log(`Image URL: ${parsed.image.large || parsed.image.small}`);
            } else if (parsed.coins && parsed.coins.length > 0) {
              console.log(`Found ${parsed.coins.length} coins`);
              console.log(`First: ${parsed.coins[0].name} - ${parsed.coins[0].large || parsed.coins[0].thumb}`);
            } else {
              console.log('Response:', JSON.stringify(parsed).substring(0, 200));
            }
          } catch (e) {
            console.log('❌ Parse error:', e.message);
            console.log('Raw response:', data.substring(0, 200));
          }
        } else {
          console.log('❌ FAILED');
          console.log('Response:', data.substring(0, 500));
        }
        resolve();
      });
    }).on('error', (e) => {
      console.log('❌ ERROR:', e.message);
      resolve();
    });
  });
}

async function main() {
  console.log('╔' + '═'.repeat(78) + '╗');
  console.log('║' + ' '.repeat(25) + 'COINGECKO API DEBUG' + ' '.repeat(32) + '║');
  console.log('╚' + '═'.repeat(78) + '╝');

  for (let i = 0; i < testUrls.length; i++) {
    await testUrl(testUrls[i], `Test ${i + 1}/${testUrls.length}`);
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('\n✨ Debug complete!\n');
}

main().catch(console.error);

