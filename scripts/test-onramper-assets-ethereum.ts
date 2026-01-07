/**
 * Test script to see what Onramper /supported/assets returns for Ethereum
 * This will help us understand why USDT is shown but has no quotes
 */

import 'dotenv/config';

const ONRAMPER_API_KEY = process.env.ONRAMPER_API_KEY?.trim().replace(/^["']|["']$/g, '') || '';

async function testSupportedAssets() {
  if (!ONRAMPER_API_KEY) {
    console.error('❌ ONRAMPER_API_KEY not found');
    process.exit(1);
  }

  console.log('🔍 Testing Onramper /supported/assets endpoint for Ethereum...\n');

  // Test 1: Get assets for EUR -> Ethereum
  console.log('📊 Test 1: EUR -> Ethereum (type=buy)');
  try {
    const url1 = `https://api.onramper.com/supported/assets?source=EUR&type=buy`;
    const response1 = await fetch(url1, {
      headers: {
        'Authorization': ONRAMPER_API_KEY,
        'Accept': 'application/json',
      },
    });

    if (response1.ok) {
      const data1 = await response1.json();
      console.log('✅ Response:', JSON.stringify(data1, null, 2));
      
      // Parse crypto's for Ethereum
      const assets = data1?.message?.assets || [];
      console.log('\n📋 Available assets:');
      for (const asset of assets) {
        console.log(`  Fiat: ${asset.fiat}`);
        console.log(`  Crypto: ${JSON.stringify(asset.crypto)}`);
        console.log(`  Payment Methods: ${JSON.stringify(asset.paymentMethods)}`);
        
        // Check for Ethereum-specific crypto's
        const ethereumCryptos = (asset.crypto || []).filter((c: string) => 
          c.includes('eth') || c === 'usdt' || c === 'usdc' || c.includes('ethereum')
        );
        if (ethereumCryptos.length > 0) {
          console.log(`  🎯 Ethereum-related crypto's: ${JSON.stringify(ethereumCryptos)}`);
        }
      }
    } else {
      console.error(`❌ Error: ${response1.status} ${response1.statusText}`);
      const errorText = await response1.text();
      console.error('Error body:', errorText);
    }
  } catch (error: any) {
    console.error('❌ Network error:', error.message);
  }

  console.log('\n\n📊 Test 2: Check if USDT has actual quotes');
  try {
    const url2 = `https://api.onramper.com/quotes?apiKey=${ONRAMPER_API_KEY}&fiatAmount=250&fiatCurrency=EUR&cryptoCurrency=USDT&network=ethereum`;
    const response2 = await fetch(url2, {
      headers: {
        'Authorization': ONRAMPER_API_KEY,
        'Accept': 'application/json',
      },
    });

    if (response2.ok) {
      const data2 = await response2.json();
      console.log('✅ Quotes response:', JSON.stringify(data2, null, 2));
      
      const quotes = data2.quotes || [];
      const validQuotes = quotes.filter((q: any) => 
        q.payout && parseFloat(q.payout.toString()) > 0
      );
      
      console.log(`\n📊 Total quotes: ${quotes.length}`);
      console.log(`✅ Valid quotes: ${validQuotes.length}`);
      
      if (validQuotes.length === 0) {
        console.log('❌ USDT has NO valid quotes on Ethereum!');
        console.log('   This means USDT should NOT be shown in the dropdown.');
      } else {
        console.log('✅ USDT has valid quotes on Ethereum');
      }
    } else {
      console.error(`❌ Error: ${response2.status} ${response2.statusText}`);
    }
  } catch (error: any) {
    console.error('❌ Network error:', error.message);
  }

  console.log('\n\n📊 Test 3: Compare with ETH quotes');
  try {
    const url3 = `https://api.onramper.com/quotes?apiKey=${ONRAMPER_API_KEY}&fiatAmount=250&fiatCurrency=EUR&cryptoCurrency=ETH&network=ethereum`;
    const response3 = await fetch(url3, {
      headers: {
        'Authorization': ONRAMPER_API_KEY,
        'Accept': 'application/json',
      },
    });

    if (response3.ok) {
      const data3 = await response3.json();
      const quotes = data3.quotes || [];
      const validQuotes = quotes.filter((q: any) => 
        q.payout && parseFloat(q.payout.toString()) > 0
      );
      
      console.log(`✅ ETH quotes: ${quotes.length} total, ${validQuotes.length} valid`);
    }
  } catch (error: any) {
    console.error('❌ Network error:', error.message);
  }
}

testSupportedAssets().catch(console.error);

