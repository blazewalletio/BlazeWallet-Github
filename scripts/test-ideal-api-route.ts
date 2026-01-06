/**
 * 🧪 TEST: iDEAL via our API route
 * 
 * Test why our API route returns 0 quotes for iDEAL when BANXA supports it
 * Run: npx tsx scripts/test-ideal-api-route.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local file
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function testIdealApiRoute() {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🧪 TEST: iDEAL via our API route`);
  console.log(`${'='.repeat(80)}\n`);
  
  const fiatAmount = 250;
  const fiatCurrency = 'EUR';
  const cryptoCurrency = 'ETH';
  const paymentMethod = 'ideal';
  
  // Test our API route
  const url = `${BASE_URL}/api/onramper/quotes?fiatAmount=${fiatAmount}&fiatCurrency=${fiatCurrency}&cryptoCurrency=${cryptoCurrency}&paymentMethod=${paymentMethod}`;
  
  console.log(`📡 Testing our API route:`);
  console.log(`   URL: ${url}\n`);
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    console.log(`📊 Response Status: ${response.status}`);
    console.log(`📊 Response Success: ${data.success}`);
    console.log(`📊 Quotes Count: ${data.quotes?.length || 0}`);
    console.log(`📊 Payment Method: ${data.paymentMethod || 'none'}\n`);
    
    if (data.quotes && data.quotes.length > 0) {
      console.log(`✅ Quotes received:\n`);
      data.quotes.forEach((q: any, idx: number) => {
        console.log(`   ${idx + 1}. ${q.ramp}`);
        console.log(`      Payment Method: ${q.paymentMethod || 'none'}`);
        console.log(`      Has Errors: ${!!(q.errors && q.errors.length > 0)}`);
        if (q.errors && q.errors.length > 0) {
          console.log(`      Errors:`, q.errors.map((e: any) => e.message || e.type).join(', '));
        }
        console.log(`      Available Methods:`, q.availablePaymentMethods?.map((pm: any) => {
          const id = pm.paymentTypeId || pm.id || '';
          const name = pm.name || '';
          return `${id} (${name})`;
        }).join(', ') || 'none');
        console.log(`      Payout: ${q.payout || 'N/A'}`);
        console.log(`      Rate: ${q.rate || 'N/A'}`);
        console.log('');
      });
      
      const banxaQuote = data.quotes.find((q: any) => q.ramp?.toLowerCase() === 'banxa');
      if (banxaQuote) {
        console.log(`✅ BANXA found in API response!`);
      } else {
        console.log(`❌ BANXA NOT found in API response`);
        console.log(`   Providers returned:`, data.quotes.map((q: any) => q.ramp).join(', '));
      }
    } else {
      console.log(`❌ No quotes returned from API`);
      console.log(`   Error: ${data.error || 'none'}`);
      console.log(`   Message: ${data.message || 'none'}`);
      console.log(`   Details: ${data.details || 'none'}\n`);
      
      // Check if it's a 200 with empty array (valid response)
      if (response.status === 200 && data.success && Array.isArray(data.quotes) && data.quotes.length === 0) {
        console.log(`⚠️  API returned 200 with empty array (valid - no providers available)`);
        console.log(`   This means our filtering is too strict or Onramper didn't return BANXA\n`);
      }
    }
    
  } catch (error: any) {
    console.log(`❌ Error: ${error.message}`);
    if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
      console.log(`   Note: Make sure the dev server is running (npm run dev)`);
    }
  }
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`✅ TEST COMPLETED`);
  console.log(`${'='.repeat(80)}\n`);
}

testIdealApiRoute().catch(console.error);

