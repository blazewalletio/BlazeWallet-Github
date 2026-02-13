#!/usr/bin/env tsx
/**
 * 🔍 COMPREHENSIVE ONRAMPER API TEST
 * Tests all endpoints with production key to verify authentication works
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const ONRAMPER_API_KEY = process.env.ONRAMPER_API_KEY || '';
const CLEAN_API_KEY = ONRAMPER_API_KEY.trim().replace(/^["']|["']$/g, '').trim();

console.log('╔═══════════════════════════════════════════════════════════════╗');
console.log('║        ONRAMPER API COMPREHENSIVE TEST                      ║');
console.log('╚═══════════════════════════════════════════════════════════════╝\n');

console.log('🔑 API Key Status:');
console.log(`   Has Key: ${!!CLEAN_API_KEY ? '✅' : '❌'}`);
console.log(`   Key Length: ${CLEAN_API_KEY.length}`);
console.log(`   Key Prefix: ${CLEAN_API_KEY.substring(0, 15)}...`);
console.log(`   Key Type: ${CLEAN_API_KEY.startsWith('pk_prod_') ? 'PRODUCTION ✅' : CLEAN_API_KEY.startsWith('pk_test_') ? 'TEST ⚠️' : 'UNKNOWN ❌'}`);
console.log(`   Raw Length: ${ONRAMPER_API_KEY.length}`);
console.log(`   Has Quotes: ${ONRAMPER_API_KEY.includes('"') || ONRAMPER_API_KEY.includes("'") ? 'YES ❌' : 'NO ✅'}\n`);

if (!CLEAN_API_KEY) {
  console.error('❌ No API key found!');
  process.exit(1);
}

interface TestResult {
  name: string;
  success: boolean;
  status?: number;
  data?: any;
  error?: string;
}

const results: TestResult[] = [];

async function testEndpoint(name: string, url: string, headers: Record<string, string> = {}): Promise<TestResult> {
  console.log(`\n📊 Testing: ${name}`);
  console.log(`   URL: ${url}`);
  console.log(`   Headers: ${JSON.stringify({ ...headers, Authorization: '***MASKED***' })}`);

  try {
    const response = await fetch(url, { headers });
    const status = response.status;
    const isSuccess = status >= 200 && status < 300;

    let data: any = null;
    try {
      const text = await response.text();
      if (text) {
        data = JSON.parse(text);
      }
    } catch (e) {
      data = { raw: 'Could not parse JSON' };
    }

    const result: TestResult = {
      name,
      success: isSuccess,
      status,
      data: isSuccess ? data : null,
      error: !isSuccess ? `HTTP ${status}: ${response.statusText}` : undefined,
    };

    if (isSuccess) {
      console.log(`   ✅ SUCCESS (${status})`);
      if (Array.isArray(data)) {
        console.log(`   📦 Response: Array with ${data.length} items`);
      } else if (data && typeof data === 'object') {
        const keys = Object.keys(data);
        console.log(`   📦 Response: Object with keys: ${keys.slice(0, 5).join(', ')}${keys.length > 5 ? '...' : ''}`);
      }
    } else {
      console.log(`   ❌ FAILED (${status})`);
      console.log(`   Error: ${result.error}`);
      if (data && typeof data === 'object') {
        console.log(`   Response: ${JSON.stringify(data).substring(0, 200)}`);
      }
    }

    return result;
  } catch (error: any) {
    const result: TestResult = {
      name,
      success: false,
      error: error.message,
    };
    console.log(`   ❌ ERROR: ${error.message}`);
    return result;
  }
}

async function runTests() {
  const baseHeaders = {
    'Authorization': CLEAN_API_KEY,
    'Accept': 'application/json',
  };

  // Test 1: Supported endpoint
  results.push(await testEndpoint(
    '1. GET /supported',
    'https://api.onramper.com/supported',
    baseHeaders
  ));

  // Test 2: Payment Types endpoint
  results.push(await testEndpoint(
    '2. GET /supported/payment-types (NL)',
    'https://api.onramper.com/supported/payment-types?type=buy&country=NL',
    baseHeaders
  ));

  // Test 3: Quotes endpoint (EUR -> ETH, no payment method)
  results.push(await testEndpoint(
    '3. GET /quotes (EUR -> ETH, no payment method)',
    'https://api.onramper.com/quotes/eur/eth?amount=100',
    baseHeaders
  ));

  // Test 4: Quotes endpoint (EUR -> ETH, with iDeal | Wero)
  results.push(await testEndpoint(
    '4. GET /quotes (EUR -> ETH, paymentMethod=ideal)',
    'https://api.onramper.com/quotes/eur/eth?amount=100&paymentMethod=ideal&country=NL',
    baseHeaders
  ));

  // Test 5: Quotes endpoint (EUR -> SOL)
  results.push(await testEndpoint(
    '5. GET /quotes (EUR -> SOL)',
    'https://api.onramper.com/quotes/eur/sol?amount=100',
    baseHeaders
  ));

  // Test 6: Fallback - Query param authentication
  if (results[0].status === 401 || results[0].status === 403) {
    console.log('\n🔄 Testing fallback: Query parameter authentication...');
    results.push(await testEndpoint(
      '6. GET /supported (with apiKey query param)',
      `https://api.onramper.com/supported?apiKey=${CLEAN_API_KEY}`,
      { 'Accept': 'application/json' }
    ));
  }

  // Summary
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║                        TEST SUMMARY                           ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  const successCount = results.filter(r => r.success).length;
  const totalCount = results.length;

  results.forEach((result, idx) => {
    const icon = result.success ? '✅' : '❌';
    const status = result.status ? ` (${result.status})` : '';
    console.log(`${icon} ${result.name}${status}`);
    if (result.error) {
      console.log(`   └─ ${result.error}`);
    }
  });

  console.log(`\n📊 Results: ${successCount}/${totalCount} tests passed`);

  if (successCount === totalCount) {
    console.log('🎉 ALL TESTS PASSED! Onramper API is working correctly!');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed. Check the errors above.');
    process.exit(1);
  }
}

runTests().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

