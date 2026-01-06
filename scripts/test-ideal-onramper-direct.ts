/**
 * 🧪 TEST: iDEAL via Onramper API (direct)
 * 
 * Test what Onramper returns with and without paymentMethod=ideal
 * Run: npx tsx scripts/test-ideal-onramper-direct.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local file
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const ONRAMPER_API_KEY = process.env.ONRAMPER_API_KEY || '';
const BASE_URL = 'https://api.onramper.com';

async function testIdealOnramperDirect() {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🧪 TEST: iDEAL via Onramper API (direct)`);
  console.log(`${'='.repeat(80)}\n`);
  
  if (!ONRAMPER_API_KEY) {
    console.log(`❌ ERROR: ONRAMPER_API_KEY not set!`);
    process.exit(1);
  }
  
  const fiatAmount = 250;
  const fiatCurrency = 'EUR';
  const cryptoCurrency = 'ETH';
  
  // Test 1: WITHOUT paymentMethod (what we currently do for iDEAL)
  console.log(`📊 TEST 1: Fetching quotes WITHOUT paymentMethod=ideal...`);
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
    
    // Find BANXA quote
    const banxa1 = quotes1.find((q: any) => q.ramp?.toLowerCase() === 'banxa');
    if (banxa1) {
      console.log(`✅ BANXA found WITHOUT paymentMethod filter:`);
      console.log(`   paymentMethod: ${banxa1.paymentMethod || 'none'}`);
      console.log(`   availablePaymentMethods:`, banxa1.availablePaymentMethods?.map((pm: any) => {
        const id = pm.paymentTypeId || pm.id || '';
        return id;
      }).join(', ') || 'none');
      console.log(`   Has Errors: ${!!(banxa1.errors && banxa1.errors.length > 0)}`);
      if (banxa1.errors && banxa1.errors.length > 0) {
        console.log(`   Errors:`, banxa1.errors.map((e: any) => e.message || e.type).join(', '));
      }
      console.log('');
    } else {
      console.log(`❌ BANXA NOT found in quotes without paymentMethod filter\n`);
    }
    
  } catch (error: any) {
    console.log(`❌ Error:`, error.message);
  }
  
  // Test 2: WITH paymentMethod=ideal (what we should do)
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
    
    // Find BANXA quote
    const banxa2 = quotes2.find((q: any) => q.ramp?.toLowerCase() === 'banxa');
    if (banxa2) {
      console.log(`✅ BANXA found WITH paymentMethod=ideal filter:`);
      console.log(`   paymentMethod: ${banxa2.paymentMethod || 'none'}`);
      console.log(`   availablePaymentMethods:`, banxa2.availablePaymentMethods?.map((pm: any) => {
        const id = pm.paymentTypeId || pm.id || '';
        return id;
      }).join(', ') || 'none');
      console.log(`   Has Errors: ${!!(banxa2.errors && banxa2.errors.length > 0)}`);
      if (banxa2.errors && banxa2.errors.length > 0) {
        console.log(`   Errors:`, banxa2.errors.map((e: any) => e.message || e.type).join(', '));
      }
      console.log(`   Payout: ${banxa2.payout || 'N/A'}`);
      console.log(`   Rate: ${banxa2.rate || 'N/A'}`);
      console.log('');
      
      // Check if it would pass our filtering
      const paymentMethodLower = 'ideal';
      const hasPaymentMethod = banxa2.paymentMethod && banxa2.paymentMethod.toLowerCase() === paymentMethodLower;
      const hasNoErrors = !banxa2.errors || banxa2.errors.length === 0;
      const hasInAvailableMethods = banxa2.availablePaymentMethods?.some((pm: any) => {
        const id = (pm.paymentTypeId || pm.id || '').toLowerCase();
        return id === paymentMethodLower || id.includes('ideal');
      });
      
      console.log(`🔍 Would pass our filtering?`);
      console.log(`   Check 1 (paymentMethod match): ${hasPaymentMethod && hasNoErrors} (${hasPaymentMethod} && ${hasNoErrors})`);
      console.log(`   Check 2 (in availablePaymentMethods): ${hasInAvailableMethods}`);
      console.log(`   ✅ Would pass: ${(hasPaymentMethod && hasNoErrors) || hasInAvailableMethods}`);
      console.log('');
    } else {
      console.log(`❌ BANXA NOT found in quotes with paymentMethod=ideal filter`);
      console.log(`   Providers returned:`, quotes2.map((q: any) => q.ramp).join(', '));
      console.log('');
    }
    
  } catch (error: any) {
    console.log(`❌ Error:`, error.message);
  }
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`✅ ALL TESTS COMPLETED`);
  console.log(`${'='.repeat(80)}\n`);
}

testIdealOnramperDirect().catch(console.error);

