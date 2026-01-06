/**
 * 🧪 TEST: Bancontact Provider Support
 * 
 * Test which providers support Bancontact
 * Run: npx tsx scripts/test-bancontact-providers.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local file
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const ONRAMPER_API_KEY = process.env.ONRAMPER_API_KEY || '';
const BASE_URL = 'https://api.onramper.com';

async function testBancontactProviders() {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🧪 TEST: Bancontact Provider Support`);
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
    
    // Find all providers that support Bancontact
    const bancontactProviders = quotes1.filter((q: any) => {
      if (q.errors && q.errors.length > 0) return false;
      
      const methods = q.availablePaymentMethods || [];
      return methods.some((pm: any) => {
        const id = (pm.paymentTypeId || pm.id || '').toLowerCase();
        return id.includes('bancontact');
      });
    });
    
    console.log(`🎯 Providers Supporting Bancontact: ${bancontactProviders.length}\n`);
    
    if (bancontactProviders.length > 0) {
      bancontactProviders.forEach((q: any, idx: number) => {
        console.log(`   ${idx + 1}. ${q.ramp}`);
        const bancontactMethods = q.availablePaymentMethods?.filter((pm: any) => {
          const id = (pm.paymentTypeId || pm.id || '').toLowerCase();
          return id.includes('bancontact');
        });
        if (bancontactMethods && bancontactMethods.length > 0) {
          console.log(`      Bancontact Methods:`, bancontactMethods.map((pm: any) => {
            const id = pm.paymentTypeId || pm.id || '';
            const name = pm.name || '';
            return `${id} (${name})`;
          }).join(', '));
        }
        console.log(`      All Available Methods:`, q.availablePaymentMethods?.map((pm: any) => {
          const id = pm.paymentTypeId || pm.id || '';
          return id;
        }).join(', ') || 'none');
        console.log('');
      });
    } else {
      console.log(`   ❌ No providers found supporting Bancontact\n`);
    }
    
  } catch (error: any) {
    console.log(`❌ Error:`, error.message);
  }
  
  // Test 2: Get quotes WITH paymentMethod=bancontact
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📊 TEST 2: Fetching quotes WITH paymentMethod=bancontact...`);
  try {
    const url2 = `${BASE_URL}/quotes/${fiatCurrency.toLowerCase()}/${cryptoCurrency.toLowerCase()}?amount=${fiatAmount}&paymentMethod=bancontact`;
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
    
    // Find valid quotes (no errors)
    const validQuotes = quotes2.filter((q: any) => !q.errors || q.errors.length === 0);
    
    console.log(`📋 Valid Quotes (no errors): ${validQuotes.length}`);
    if (validQuotes.length > 0) {
      validQuotes.forEach((q: any, idx: number) => {
        console.log(`   ${idx + 1}. ${q.ramp}: paymentMethod=${q.paymentMethod || 'none'}, payout=${q.payout || 'N/A'}`);
      });
    } else {
      console.log(`   ⚠️  All quotes have errors (providers don't support bancontact via API filter)`);
      console.log(`   But they might support it in availablePaymentMethods (see Test 1)`);
    }
    
  } catch (error: any) {
    console.log(`❌ Error:`, error.message);
  }
  
  // Test 3: Test with BE country code
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📊 TEST 3: Testing with BE (Belgium) country code...`);
  try {
    const url3 = `${BASE_URL}/quotes/${fiatCurrency.toLowerCase()}/${cryptoCurrency.toLowerCase()}?amount=${fiatAmount}&country=be`;
    const response3 = await fetch(url3, {
      headers: {
        'Authorization': ONRAMPER_API_KEY,
        'Accept': 'application/json',
      },
    });
    
    if (!response3.ok) {
      console.log(`❌ Error: ${response3.status} ${response3.statusText}`);
      return;
    }
    
    const data3 = await response3.json();
    const quotes3 = Array.isArray(data3) ? data3 : [];
    
    // Find providers that support Bancontact with BE country
    const bancontactProvidersBE = quotes3.filter((q: any) => {
      if (q.errors && q.errors.length > 0) return false;
      
      const methods = q.availablePaymentMethods || [];
      return methods.some((pm: any) => {
        const id = (pm.paymentTypeId || pm.id || '').toLowerCase();
        return id.includes('bancontact');
      });
    });
    
    console.log(`✅ Received ${quotes3.length} quotes with BE country`);
    console.log(`🎯 Providers Supporting Bancontact (BE): ${bancontactProvidersBE.length}`);
    if (bancontactProvidersBE.length > 0) {
      bancontactProvidersBE.forEach((q: any) => {
        console.log(`   - ${q.ramp}`);
      });
    }
    
  } catch (error: any) {
    console.log(`❌ Error:`, error.message);
  }
  
  // Test 4: Test with NL country code (should not show Bancontact)
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📊 TEST 4: Testing with NL (Netherlands) country code...`);
  try {
    const url4 = `${BASE_URL}/quotes/${fiatCurrency.toLowerCase()}/${cryptoCurrency.toLowerCase()}?amount=${fiatAmount}&country=nl`;
    const response4 = await fetch(url4, {
      headers: {
        'Authorization': ONRAMPER_API_KEY,
        'Accept': 'application/json',
      },
    });
    
    if (!response4.ok) {
      console.log(`❌ Error: ${response4.status} ${response4.statusText}`);
      return;
    }
    
    const data4 = await response4.json();
    const quotes4 = Array.isArray(data4) ? data4 : [];
    
    // Find providers that support Bancontact with NL country
    const bancontactProvidersNL = quotes4.filter((q: any) => {
      if (q.errors && q.errors.length > 0) return false;
      
      const methods = q.availablePaymentMethods || [];
      return methods.some((pm: any) => {
        const id = (pm.paymentTypeId || pm.id || '').toLowerCase();
        return id.includes('bancontact');
      });
    });
    
    console.log(`✅ Received ${quotes4.length} quotes with NL country`);
    console.log(`🎯 Providers Supporting Bancontact (NL): ${bancontactProvidersNL.length}`);
    if (bancontactProvidersNL.length > 0) {
      console.log(`   ⚠️  WARNING: Bancontact should only be available in BE, not NL!`);
      bancontactProvidersNL.forEach((q: any) => {
        console.log(`   - ${q.ramp}`);
      });
    } else {
      console.log(`   ✅ Correct: No Bancontact providers for NL`);
    }
    
  } catch (error: any) {
    console.log(`❌ Error:`, error.message);
  }
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`✅ ALL TESTS COMPLETED`);
  console.log(`${'='.repeat(80)}\n`);
}

testBancontactProviders().catch(console.error);

