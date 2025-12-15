/**
 * Test script to verify Onramper API key is working
 * Run: node test-onramper-api.js
 */

const API_KEY = 'pk_prod_01KBJCSS9G727A14XA544DSS7D';

async function testOnramperAPI() {
  console.log('🧪 Testing Onramper API Key...\n');
  console.log('API Key:', API_KEY.substring(0, 15) + '...\n');

  // Test 1: Get Quote
  console.log('📊 Test 1: Fetching quote (EUR → ETH)...');
  try {
    const quoteUrl = `https://api.onramper.com/quotes/eur/eth?amount=100`;
    
    // Try Bearer token method
    let response = await fetch(quoteUrl, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok && (response.status === 401 || response.status === 403)) {
      // Try direct API key
      response = await fetch(quoteUrl, {
        headers: {
          'Authorization': API_KEY,
          'Accept': 'application/json',
        },
      });
    }

    if (!response.ok && (response.status === 401 || response.status === 403)) {
      // Try query param
      const quoteUrlWithKey = `${quoteUrl}&apiKey=${API_KEY}`;
      response = await fetch(quoteUrlWithKey, {
        headers: {
          'Accept': 'application/json',
        },
      });
    }

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Quote API: SUCCESS');
      if (Array.isArray(data) && data.length > 0) {
        const quote = data[0];
        console.log(`   Payout: ${quote.payout || 'N/A'} ETH`);
        console.log(`   Rate: ${quote.rate || 'N/A'}`);
        console.log(`   Network Fee: ${quote.networkFee || 'N/A'}`);
        console.log(`   Transaction Fee: ${quote.transactionFee || 'N/A'}`);
      } else if (data.payout) {
        console.log(`   Payout: ${data.payout} ETH`);
        console.log(`   Rate: ${data.rate}`);
      }
    } else {
      const errorText = await response.text();
      console.log('❌ Quote API: FAILED');
      console.log(`   Status: ${response.status}`);
      console.log(`   Error: ${errorText.substring(0, 200)}`);
    }
  } catch (error) {
    console.log('❌ Quote API: ERROR');
    console.log(`   ${error.message}`);
  }

  console.log('\n');

  // Test 2: Get Supported Data
  console.log('📋 Test 2: Fetching supported data...');
  try {
    const supportedUrl = 'https://api.onramper.com/supported';
    
    let response = await fetch(supportedUrl, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok && (response.status === 401 || response.status === 403)) {
      response = await fetch(supportedUrl, {
        headers: {
          'Authorization': API_KEY,
          'Accept': 'application/json',
        },
      });
    }

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Supported Data API: SUCCESS');
      console.log(`   Response keys: ${Object.keys(data).join(', ')}`);
    } else {
      const errorText = await response.text();
      console.log('❌ Supported Data API: FAILED');
      console.log(`   Status: ${response.status}`);
      console.log(`   Error: ${errorText.substring(0, 200)}`);
    }
  } catch (error) {
    console.log('❌ Supported Data API: ERROR');
    console.log(`   ${error.message}`);
  }

  console.log('\n');

  // Test 3: Payment Types
  console.log('💳 Test 3: Fetching payment types...');
  try {
    const paymentTypesUrl = 'https://api.onramper.com/supported/payment-types?type=buy&country=NL';
    
    let response = await fetch(paymentTypesUrl, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok && (response.status === 401 || response.status === 403)) {
      response = await fetch(paymentTypesUrl, {
        headers: {
          'Authorization': API_KEY,
          'Accept': 'application/json',
        },
      });
    }

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Payment Types API: SUCCESS');
      if (Array.isArray(data)) {
        console.log(`   Found ${data.length} payment methods`);
        if (data.length > 0) {
          console.log(`   Examples: ${data.slice(0, 3).map(pm => pm.name || pm.id).join(', ')}`);
        }
      } else {
        console.log(`   Response type: ${typeof data}`);
        console.log(`   Keys: ${Object.keys(data).join(', ')}`);
      }
    } else {
      const errorText = await response.text();
      console.log('❌ Payment Types API: FAILED');
      console.log(`   Status: ${response.status}`);
      console.log(`   Error: ${errorText.substring(0, 200)}`);
    }
  } catch (error) {
    console.log('❌ Payment Types API: ERROR');
    console.log(`   ${error.message}`);
  }

  console.log('\n✅ API Key testing complete!\n');
}

testOnramperAPI().catch(console.error);

