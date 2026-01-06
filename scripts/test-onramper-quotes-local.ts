/**
 * 🧪 LOCAL TEST: Onramper Quotes API
 * 
 * Test how Onramper API actually works with different payment methods
 * Run: npx tsx scripts/test-onramper-quotes-local.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local file
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const ONRAMPER_API_KEY = process.env.ONRAMPER_API_KEY || '';
const BASE_URL = 'https://api.onramper.com';

interface TestCase {
  name: string;
  fiatAmount: number;
  fiatCurrency: string;
  cryptoCurrency: string;
  paymentMethod?: string;
  country?: string;
}

const testCases: TestCase[] = [
  // Test without payment method (should return all providers)
  {
    name: 'ETH/EUR - No payment method',
    fiatAmount: 250,
    fiatCurrency: 'EUR',
    cryptoCurrency: 'ETH',
  },
  // Test with different payment methods
  {
    name: 'ETH/EUR - Creditcard',
    fiatAmount: 250,
    fiatCurrency: 'EUR',
    cryptoCurrency: 'ETH',
    paymentMethod: 'creditcard',
  },
  {
    name: 'ETH/EUR - Bancontact',
    fiatAmount: 250,
    fiatCurrency: 'EUR',
    cryptoCurrency: 'ETH',
    paymentMethod: 'bancontact',
  },
  {
    name: 'ETH/EUR - SEPA',
    fiatAmount: 250,
    fiatCurrency: 'EUR',
    cryptoCurrency: 'ETH',
    paymentMethod: 'sepa',
  },
  {
    name: 'ETH/EUR - ApplePay',
    fiatAmount: 250,
    fiatCurrency: 'EUR',
    cryptoCurrency: 'ETH',
    paymentMethod: 'applepay',
  },
  {
    name: 'ETH/EUR - GooglePay',
    fiatAmount: 250,
    fiatCurrency: 'EUR',
    cryptoCurrency: 'ETH',
    paymentMethod: 'googlepay',
  },
  // Test USDT
  {
    name: 'USDT/EUR - Creditcard',
    fiatAmount: 250,
    fiatCurrency: 'EUR',
    cryptoCurrency: 'USDT',
    paymentMethod: 'creditcard',
  },
  {
    name: 'USDT/EUR - ApplePay',
    fiatAmount: 250,
    fiatCurrency: 'EUR',
    cryptoCurrency: 'USDT',
    paymentMethod: 'applepay',
  },
];

async function testOnramperAPI(testCase: TestCase) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🧪 TEST: ${testCase.name}`);
  console.log(`${'='.repeat(80)}`);
  
  try {
    // Build URL
    const url = new URL(`${BASE_URL}/quotes/${testCase.fiatCurrency.toLowerCase()}/${testCase.cryptoCurrency.toLowerCase()}`);
    url.searchParams.set('amount', testCase.fiatAmount.toString());
    if (testCase.paymentMethod) {
      url.searchParams.set('paymentMethod', testCase.paymentMethod);
    }
    if (testCase.country) {
      url.searchParams.set('country', testCase.country);
    }
    
    console.log(`📡 URL: ${url.toString()}`);
    console.log(`🔑 API Key: ${ONRAMPER_API_KEY ? ONRAMPER_API_KEY.substring(0, 10) + '...' : 'MISSING'}`);
    
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': ONRAMPER_API_KEY,
        'Content-Type': 'application/json',
      },
    });
    
    console.log(`📊 Status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ Error Response:`, errorText.substring(0, 500));
      return;
    }
    
    const data = await response.json();
    
    console.log(`✅ Response Type:`, Array.isArray(data) ? 'Array' : typeof data);
    
    if (Array.isArray(data)) {
      console.log(`📦 Quotes Count: ${data.length}`);
      
      if (data.length === 0) {
        console.log(`⚠️  WARNING: Empty quotes array!`);
        return;
      }
      
      // Analyze first few quotes
      const sampleQuotes = data.slice(0, 3);
      sampleQuotes.forEach((quote: any, idx: number) => {
        console.log(`\n📋 Quote ${idx + 1}:`);
        console.log(`   Provider: ${quote.ramp || 'unknown'}`);
        console.log(`   Payment Method: ${quote.paymentMethod || 'none'}`);
        console.log(`   Available Methods: ${quote.availablePaymentMethods?.map((pm: any) => pm.paymentTypeId || pm.id).join(', ') || 'none'}`);
        console.log(`   Has Errors: ${!!(quote.errors && quote.errors.length > 0)}`);
        if (quote.errors && quote.errors.length > 0) {
          console.log(`   Errors:`, quote.errors.map((e: any) => e.message || e.type).join(', '));
        }
        console.log(`   Payout: ${quote.payout || 'N/A'}`);
        console.log(`   Rate: ${quote.rate || 'N/A'}`);
      });
      
      // Check if requested payment method is supported
      if (testCase.paymentMethod) {
        const paymentMethodLower = testCase.paymentMethod.toLowerCase();
        const supportingProviders = data.filter((q: any) => {
          if (q.errors && q.errors.length > 0) return false;
          
          // Check if payment method matches
          if (q.paymentMethod && q.paymentMethod.toLowerCase() === paymentMethodLower) {
            return true;
          }
          
          // Check availablePaymentMethods
          const methods = q.availablePaymentMethods || [];
          return methods.some((pm: any) => {
            const id = (pm.paymentTypeId || pm.id || '').toLowerCase();
            return id === paymentMethodLower || id.includes(paymentMethodLower);
          });
        });
        
        console.log(`\n🔍 Payment Method Analysis:`);
        console.log(`   Requested: ${testCase.paymentMethod}`);
        console.log(`   Supporting Providers: ${supportingProviders.length}`);
        if (supportingProviders.length > 0) {
          console.log(`   Providers: ${supportingProviders.map((q: any) => q.ramp).join(', ')}`);
        } else {
          console.log(`   ⚠️  NO PROVIDERS SUPPORT ${testCase.paymentMethod}!`);
        }
      }
    } else {
      console.log(`❌ Unexpected response format:`, JSON.stringify(data).substring(0, 500));
    }
    
  } catch (error: any) {
    console.log(`❌ ERROR:`, error.message);
    console.log(`   Stack:`, error.stack?.substring(0, 300));
  }
}

async function runAllTests() {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🚀 STARTING ONRAMPER API TESTS`);
  console.log(`${'='.repeat(80)}`);
  
  if (!ONRAMPER_API_KEY) {
    console.log(`❌ ERROR: ONRAMPER_API_KEY not set!`);
    console.log(`   Set it with: export ONRAMPER_API_KEY=your_key_here`);
    process.exit(1);
  }
  
  for (const testCase of testCases) {
    await testOnramperAPI(testCase);
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`✅ ALL TESTS COMPLETED`);
  console.log(`${'='.repeat(80)}\n`);
}

runAllTests().catch(console.error);

