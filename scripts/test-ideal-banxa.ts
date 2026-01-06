/**
 * 🧪 TEST: iDEAL + BANXA Availability
 * 
 * Test why iDEAL is marked as unavailable when BANXA supports it
 * Run: npx tsx scripts/test-ideal-banxa.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local file
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const ONRAMPER_API_KEY = process.env.ONRAMPER_API_KEY || '';
const BASE_URL = 'https://api.onramper.com';

async function testIdealBanxa() {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🧪 TEST: iDEAL + BANXA Availability`);
  console.log(`${'='.repeat(80)}\n`);
  
  if (!ONRAMPER_API_KEY) {
    console.log(`❌ ERROR: ONRAMPER_API_KEY not set!`);
    process.exit(1);
  }
  
  const fiatAmount = 250;
  const fiatCurrency = 'EUR';
  const cryptoCurrency = 'ETH';
  
  // Test 1: Get quotes WITHOUT payment method (to see all providers and their available methods)
  console.log(`📊 TEST 1: Fetching quotes WITHOUT payment method...`);
  try {
    const url1 = `${BASE_URL}/quotes/${fiatCurrency.toLowerCase()}/${cryptoCurrency.toLowerCase()}?amount=${fiatAmount}`;
    const response1 = await fetch(url1, {
      headers: {
        'Authorization': ONRAMPER_API_KEY,
        'Accept': 'application/json',
      },
    });
    
    if (!response1.ok) {
      console.log(`❌ Error: ${response1.status} ${response1.statusText}`);
      return;
    }
    
    const data1 = await response1.json();
    const quotes1 = Array.isArray(data1) ? data1 : [];
    
    console.log(`✅ Received ${quotes1.length} quotes\n`);
    
    // Find BANXA specifically
    const banxaQuote = quotes1.find((q: any) => q.ramp?.toLowerCase() === 'banxa');
    
    if (banxaQuote) {
      console.log(`🎯 BANXA Quote Found:`);
      console.log(`   Provider: ${banxaQuote.ramp}`);
      console.log(`   Payment Method: ${banxaQuote.paymentMethod || 'none'}`);
      console.log(`   Has Errors: ${!!(banxaQuote.errors && banxaQuote.errors.length > 0)}`);
      if (banxaQuote.errors && banxaQuote.errors.length > 0) {
        console.log(`   Errors:`, banxaQuote.errors.map((e: any) => e.message || e.type).join(', '));
      }
      console.log(`   Available Payment Methods:`, banxaQuote.availablePaymentMethods?.map((pm: any) => {
        const id = pm.paymentTypeId || pm.id || '';
        const name = pm.name || '';
        return `${id} (${name})`;
      }).join(', ') || 'none');
      
      // Check specifically for iDEAL
      const hasIdeal = banxaQuote.availablePaymentMethods?.some((pm: any) => {
        const id = (pm.paymentTypeId || pm.id || '').toLowerCase();
        return id.includes('ideal');
      });
      
      console.log(`\n   🔍 iDEAL Support Check:`);
      console.log(`      Has iDEAL in availablePaymentMethods: ${hasIdeal ? '✅ YES' : '❌ NO'}`);
      
      if (hasIdeal) {
        const idealMethods = banxaQuote.availablePaymentMethods?.filter((pm: any) => {
          const id = (pm.paymentTypeId || pm.id || '').toLowerCase();
          return id.includes('ideal');
        });
        console.log(`      iDEAL Methods Found:`, idealMethods?.map((pm: any) => {
          const id = pm.paymentTypeId || pm.id || '';
          const name = pm.name || '';
          return `${id} (${name})`;
        }).join(', '));
      }
    } else {
      console.log(`❌ BANXA not found in quotes!`);
    }
    
  } catch (error: any) {
    console.log(`❌ Error:`, error.message);
  }
  
  // Test 2: Get quotes WITH paymentMethod=ideal
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📊 TEST 2: Fetching quotes WITH paymentMethod=ideal...`);
  try {
    const url2 = `${BASE_URL}/quotes/${fiatCurrency.toLowerCase()}/${cryptoCurrency.toLowerCase()}?amount=${fiatAmount}&paymentMethod=ideal`;
    const response2 = await fetch(url2, {
      headers: {
        'Authorization': ONRAMPER_API_KEY,
        'Accept': 'application/json',
      },
    });
    
    if (!response2.ok) {
      console.log(`❌ Error: ${response2.status} ${response2.statusText}`);
      const errorText = await response2.text();
      console.log(`   Error Response:`, errorText.substring(0, 500));
      return;
    }
    
    const data2 = await response2.json();
    const quotes2 = Array.isArray(data2) ? data2 : [];
    
    console.log(`✅ Received ${quotes2.length} quotes\n`);
    
    // Find BANXA specifically
    const banxaQuote2 = quotes2.find((q: any) => q.ramp?.toLowerCase() === 'banxa');
    
    if (banxaQuote2) {
      console.log(`🎯 BANXA Quote Found (WITH ideal filter):`);
      console.log(`   Provider: ${banxaQuote2.ramp}`);
      console.log(`   Payment Method: ${banxaQuote2.paymentMethod || 'none'}`);
      console.log(`   Has Errors: ${!!(banxaQuote2.errors && banxaQuote2.errors.length > 0)}`);
      if (banxaQuote2.errors && banxaQuote2.errors.length > 0) {
        console.log(`   Errors:`, banxaQuote2.errors.map((e: any) => e.message || e.type).join(', '));
      }
      console.log(`   Available Payment Methods:`, banxaQuote2.availablePaymentMethods?.map((pm: any) => {
        const id = pm.paymentTypeId || pm.id || '';
        const name = pm.name || '';
        return `${id} (${name})`;
      }).join(', ') || 'none');
      console.log(`   Payout: ${banxaQuote2.payout || 'N/A'}`);
      console.log(`   Rate: ${banxaQuote2.rate || 'N/A'}`);
    } else {
      console.log(`❌ BANXA not found in quotes when filtering by ideal!`);
    }
    
    // Check all providers
    console.log(`\n📋 All Providers with ideal filter:`);
    quotes2.forEach((q: any, idx: number) => {
      console.log(`   ${idx + 1}. ${q.ramp}: hasErrors=${!!(q.errors && q.errors.length > 0)}, paymentMethod=${q.paymentMethod || 'none'}`);
    });
    
    // Check valid quotes (no errors)
    const validQuotes = quotes2.filter((q: any) => !q.errors || q.errors.length === 0);
    console.log(`\n✅ Valid Quotes (no errors): ${validQuotes.length}`);
    validQuotes.forEach((q: any) => {
      console.log(`   - ${q.ramp}: paymentMethod=${q.paymentMethod || 'none'}`);
    });
    
  } catch (error: any) {
    console.log(`❌ Error:`, error.message);
  }
  
  // Test 3: Test with different iDEAL variants
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📊 TEST 3: Testing different iDEAL variants...`);
  
  const idealVariants = ['ideal', 'idealbanktransfer', 'idealinstant'];
  
  for (const variant of idealVariants) {
    try {
      const url3 = `${BASE_URL}/quotes/${fiatCurrency.toLowerCase()}/${cryptoCurrency.toLowerCase()}?amount=${fiatAmount}&paymentMethod=${variant}`;
      const response3 = await fetch(url3, {
        headers: {
          'Authorization': ONRAMPER_API_KEY,
          'Accept': 'application/json',
        },
      });
      
      if (!response3.ok) {
        console.log(`   ❌ ${variant}: ${response3.status} ${response3.statusText}`);
        continue;
      }
      
      const data3 = await response3.json();
      const quotes3 = Array.isArray(data3) ? data3 : [];
      const validQuotes3 = quotes3.filter((q: any) => !q.errors || q.errors.length === 0);
      const banxaQuote3 = validQuotes3.find((q: any) => q.ramp?.toLowerCase() === 'banxa');
      
      console.log(`   ${variant}: ${validQuotes3.length} valid quotes${banxaQuote3 ? ' (BANXA ✅)' : ' (no BANXA ❌)'}`);
      
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error: any) {
      console.log(`   ❌ ${variant}: Error - ${error.message}`);
    }
  }
  
  // Test 4: Test our API route
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📊 TEST 4: Testing our API route /api/onramper/quotes...`);
  
  try {
    const url4 = `http://localhost:3000/api/onramper/quotes?fiatAmount=${fiatAmount}&fiatCurrency=${fiatCurrency}&cryptoCurrency=${cryptoCurrency}&paymentMethod=ideal`;
    console.log(`   URL: ${url4}`);
    
    const response4 = await fetch(url4);
    const data4 = await response4.json();
    
    console.log(`   Status: ${response4.status}`);
    console.log(`   Success: ${data4.success}`);
    console.log(`   Quotes Count: ${data4.quotes?.length || 0}`);
    
    if (data4.quotes && data4.quotes.length > 0) {
      const banxaQuote4 = data4.quotes.find((q: any) => q.ramp?.toLowerCase() === 'banxa');
      if (banxaQuote4) {
        console.log(`   ✅ BANXA found in our API response!`);
        console.log(`      Payment Method: ${banxaQuote4.paymentMethod || 'none'}`);
        console.log(`      Has Errors: ${!!(banxaQuote4.errors && banxaQuote4.errors.length > 0)}`);
      } else {
        console.log(`   ❌ BANXA NOT found in our API response`);
        console.log(`   Providers returned:`, data4.quotes.map((q: any) => q.ramp).join(', '));
      }
    } else {
      console.log(`   ⚠️  No quotes returned from our API`);
      console.log(`   Error: ${data4.error || 'none'}`);
      console.log(`   Message: ${data4.message || 'none'}`);
    }
  } catch (error: any) {
    console.log(`   ❌ Error: ${error.message}`);
    console.log(`   Note: Make sure the dev server is running (npm run dev)`);
  }
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`✅ ALL TESTS COMPLETED`);
  console.log(`${'='.repeat(80)}\n`);
}

testIdealBanxa().catch(console.error);

