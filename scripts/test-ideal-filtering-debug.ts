/**
 * 🧪 TEST: Debug iDeal | Wero filtering logic
 * 
 * Test what happens when we get quotes from Onramper with paymentMethod=ideal
 * Run: npx tsx scripts/test-ideal-filtering-debug.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local file
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const ONRAMPER_API_KEY = process.env.ONRAMPER_API_KEY || '';
const BASE_URL = 'https://api.onramper.com';

async function testIdealFilteringDebug() {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🧪 TEST: Debug iDeal | Wero Filtering Logic`);
  console.log(`${'='.repeat(80)}\n`);
  
  if (!ONRAMPER_API_KEY) {
    console.log(`❌ ERROR: ONRAMPER_API_KEY not set!`);
    process.exit(1);
  }
  
  const fiatAmount = 250;
  const fiatCurrency = 'EUR';
  const cryptoCurrency = 'ETH';
  const paymentMethod = 'ideal';
  const paymentMethodLower = paymentMethod.toLowerCase();
  const isIdeal = paymentMethodLower.includes('ideal');
  
  console.log(`📊 Testing with:`);
  console.log(`   Fiat: ${fiatCurrency} ${fiatAmount}`);
  console.log(`   Crypto: ${cryptoCurrency}`);
  console.log(`   Payment Method: ${paymentMethod}`);
  console.log(`   paymentMethodLower: ${paymentMethodLower}`);
  console.log(`   isIdeal: ${isIdeal}\n`);
  
  // Fetch quotes with paymentMethod=ideal
  const url = `${BASE_URL}/quotes/${fiatCurrency.toLowerCase()}/${cryptoCurrency.toLowerCase()}?amount=${fiatAmount}&paymentMethod=${paymentMethodLower}`;
  
  console.log(`📡 Fetching quotes from Onramper:`);
  console.log(`   URL: ${url}\n`);
  
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': ONRAMPER_API_KEY,
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      console.log(`❌ Error: ${response.status} ${response.statusText}`);
      return;
    }
    
    const quotes = await response.json();
    const quotesArray = Array.isArray(quotes) ? quotes : [];
    
    console.log(`✅ Received ${quotesArray.length} quotes from Onramper\n`);
    
    // Find BANXA
    const banxa = quotesArray.find((q: any) => q.ramp?.toLowerCase() === 'banxa');
    
    if (!banxa) {
      console.log(`❌ BANXA NOT found in quotes!`);
      console.log(`   Providers:`, quotesArray.map((q: any) => q.ramp).join(', '));
      return;
    }
    
    console.log(`✅ BANXA found! Analyzing quote:\n`);
    console.log(`   ramp: ${banxa.ramp}`);
    console.log(`   paymentMethod: ${banxa.paymentMethod || 'none'}`);
    console.log(`   hasErrors: ${!!(banxa.errors && banxa.errors.length > 0)}`);
    if (banxa.errors && banxa.errors.length > 0) {
      console.log(`   errors:`, JSON.stringify(banxa.errors, null, 2));
    }
    console.log(`   availablePaymentMethods:`, banxa.availablePaymentMethods?.map((pm: any) => {
      const id = pm.paymentTypeId || pm.id || '';
      const name = pm.name || '';
      return `${id} (${name})`;
    }).join(', ') || 'none');
    console.log(`   payout: ${banxa.payout || 'N/A'}`);
    console.log(`   rate: ${banxa.rate || 'N/A'}\n`);
    
    // Test our filtering logic
    console.log(`🔍 Testing our filtering logic:\n`);
    
    // PRIMARY CHECK
    console.log(`   1. PRIMARY CHECK: paymentMethod match`);
    const hasPaymentMethod = banxa.paymentMethod && banxa.paymentMethod.toLowerCase() === paymentMethodLower;
    console.log(`      banxa.paymentMethod: ${banxa.paymentMethod || 'none'}`);
    console.log(`      paymentMethodLower: ${paymentMethodLower}`);
    console.log(`      Match: ${hasPaymentMethod}`);
    
    if (hasPaymentMethod) {
      const hasPaymentMethodError = banxa.errors?.some((err: any) => {
        const errorMsg = (err.message || '').toLowerCase();
        const errorType = (err.type || '').toLowerCase();
        return errorMsg.includes('does not support payment method') ||
               errorMsg.includes('payment method not supported') ||
               errorMsg.includes('payment type not supported') ||
               errorType === 'paymentmethodnotsupported';
      });
      console.log(`      Has payment-method-specific error: ${hasPaymentMethodError}`);
      if (hasPaymentMethodError && banxa.errors) {
        console.log(`      Payment method errors:`, banxa.errors.filter((err: any) => {
          const errorMsg = (err.message || '').toLowerCase();
          const errorType = (err.type || '').toLowerCase();
          return errorMsg.includes('does not support payment method') ||
                 errorMsg.includes('payment method not supported') ||
                 errorMsg.includes('payment type not supported') ||
                 errorType === 'paymentmethodnotsupported';
        }).map((e: any) => e.message || e.type));
      }
      console.log(`      ✅ Would pass PRIMARY CHECK: ${hasPaymentMethod && !hasPaymentMethodError}`);
    }
    
    // FALLBACK CHECK
    console.log(`\n   2. FALLBACK CHECK: availablePaymentMethods`);
    const methods = banxa.availablePaymentMethods || [];
    const methodIds = methods.map((pm: any) => (pm.paymentTypeId || pm.id || '').toLowerCase()).filter(Boolean);
    console.log(`      methodIds: ${methodIds.join(', ') || 'none'}`);
    
    const supportsMethod = methodIds.some((idLower: string) => {
      if (idLower === paymentMethodLower) {
        return true;
      }
      if (isIdeal && idLower.includes('ideal')) {
        return true;
      }
      return false;
    });
    console.log(`      ✅ Would pass FALLBACK CHECK: ${supportsMethod}`);
    
    // FINAL RESULT
    const wouldPassPrimary = hasPaymentMethod && !banxa.errors?.some((err: any) => {
      const errorMsg = (err.message || '').toLowerCase();
      const errorType = (err.type || '').toLowerCase();
      return errorMsg.includes('does not support payment method') ||
             errorMsg.includes('payment method not supported') ||
             errorMsg.includes('payment type not supported') ||
             errorType === 'paymentmethodnotsupported';
    });
    
    const finalResult = wouldPassPrimary || supportsMethod;
    console.log(`\n   🎯 FINAL RESULT: Would be accepted: ${finalResult}`);
    console.log(`      (Primary: ${wouldPassPrimary}, Fallback: ${supportsMethod})`);
    
  } catch (error: any) {
    console.log(`❌ Error:`, error.message);
    console.log(error.stack);
  }
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`✅ TEST COMPLETED`);
  console.log(`${'='.repeat(80)}\n`);
}

testIdealFilteringDebug().catch(console.error);

