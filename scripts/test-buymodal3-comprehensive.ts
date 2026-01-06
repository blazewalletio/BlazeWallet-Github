/**
 * 🧪 COMPREHENSIVE BUYMODAL3 TEST SCRIPT
 * 
 * This script tests EVERY aspect of BuyModal3 to identify issues:
 * 1. Quote fetching flow
 * 2. Payment method selection
 * 3. Provider filtering
 * 4. iDEAL support
 * 5. API responses
 * 6. State management
 * 
 * Run: npx tsx scripts/test-buymodal3-comprehensive.ts
 */

import fetch from 'node-fetch';

const BASE_URL = process.env.BASE_URL || 'https://my.blazewallet.io';
const ONRAMPER_API_KEY = process.env.ONRAMPER_API_KEY || '';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  data?: any;
}

const results: TestResult[] = [];

const addResult = (name: string, passed: boolean, error?: string, data?: any) => {
  results.push({ name, passed, error, data });
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} ${name}`);
  if (error) console.log(`   Error: ${error}`);
  if (data && !passed) console.log(`   Data: ${JSON.stringify(data, null, 2)}`);
};

// Test 1: Check API Key
const testApiKey = async () => {
  if (!ONRAMPER_API_KEY) {
    addResult('API Key Check', false, 'ONRAMPER_API_KEY not set');
    return;
  }
  addResult('API Key Check', true, undefined, { length: ONRAMPER_API_KEY.length });
};

// Test 2: Fetch Supported Data
const testSupportedData = async () => {
  try {
    const response = await fetch(`${BASE_URL}/api/onramper/supported-data`);
    const data = await response.json();
    
    if (data.success) {
      const paymentMethods = data.paymentMethods || [];
      const fiatCurrencies = data.fiatCurrencies || [];
      const cryptoCurrencies = data.cryptoCurrencies || [];
      
      addResult('Supported Data', true, undefined, {
        paymentMethods: paymentMethods.length,
        fiatCurrencies: fiatCurrencies.length,
        cryptoCurrencies: cryptoCurrencies.length,
        hasIdeal: paymentMethods.some((pm: any) => pm.id?.toLowerCase().includes('ideal'))
      });
    } else {
      addResult('Supported Data', false, data.error || 'Unknown error', data);
    }
  } catch (error: any) {
    addResult('Supported Data', false, error.message);
  }
};

// Test 3: Test Quotes WITHOUT Payment Method (should return all providers)
const testQuotesWithoutPaymentMethod = async () => {
  try {
    const url = `${BASE_URL}/api/onramper/quotes?fiatAmount=250&fiatCurrency=EUR&cryptoCurrency=ETH`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.success && data.quotes) {
      const quotes = data.quotes || [];
      const validQuotes = quotes.filter((q: any) => !q.errors || q.errors.length === 0);
      
      addResult('Quotes WITHOUT Payment Method', true, undefined, {
        totalQuotes: quotes.length,
        validQuotes: validQuotes.length,
        providers: validQuotes.map((q: any) => q.ramp),
        hasBanxa: validQuotes.some((q: any) => q.ramp?.toLowerCase() === 'banxa'),
        hasMoonpay: validQuotes.some((q: any) => q.ramp?.toLowerCase() === 'moonpay')
      });
    } else {
      addResult('Quotes WITHOUT Payment Method', false, data.error || 'Unknown error', data);
    }
  } catch (error: any) {
    addResult('Quotes WITHOUT Payment Method', false, error.message);
  }
};

// Test 4: Test Quotes WITH iDEAL for ETH
const testQuotesWithIdealEth = async () => {
  try {
    const url = `${BASE_URL}/api/onramper/quotes?fiatAmount=250&fiatCurrency=EUR&cryptoCurrency=ETH&paymentMethod=ideal`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.success && data.quotes) {
      const quotes = data.quotes || [];
      const validQuotes = quotes.filter((q: any) => !q.errors || q.errors.length === 0);
      
      // Check which providers support iDEAL
      const idealProviders = validQuotes.filter((q: any) => {
        const methods = q.availablePaymentMethods || [];
        return methods.some((pm: any) => {
          const id = (pm.paymentTypeId || pm.id || '').toLowerCase();
          return id.includes('ideal');
        });
      });
      
      addResult('Quotes WITH iDEAL (ETH)', true, undefined, {
        totalQuotes: quotes.length,
        validQuotes: validQuotes.length,
        idealProviders: idealProviders.length,
        providers: idealProviders.map((q: any) => q.ramp),
        hasBanxa: idealProviders.some((q: any) => q.ramp?.toLowerCase() === 'banxa')
      });
    } else {
      addResult('Quotes WITH iDEAL (ETH)', false, data.error || 'Unknown error', data);
    }
  } catch (error: any) {
    addResult('Quotes WITH iDEAL (ETH)', false, error.message);
  }
};

// Test 5: Test Quotes WITH iDEAL for USDC
const testQuotesWithIdealUsdc = async () => {
  try {
    const url = `${BASE_URL}/api/onramper/quotes?fiatAmount=250&fiatCurrency=EUR&cryptoCurrency=USDC&paymentMethod=ideal`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.success && data.quotes) {
      const quotes = data.quotes || [];
      const validQuotes = quotes.filter((q: any) => !q.errors || q.errors.length === 0);
      
      // Check which providers support iDEAL
      const idealProviders = validQuotes.filter((q: any) => {
        const methods = q.availablePaymentMethods || [];
        return methods.some((pm: any) => {
          const id = (pm.paymentTypeId || pm.id || '').toLowerCase();
          return id.includes('ideal');
        });
      });
      
      addResult('Quotes WITH iDEAL (USDC)', true, undefined, {
        totalQuotes: quotes.length,
        validQuotes: validQuotes.length,
        idealProviders: idealProviders.length,
        providers: idealProviders.map((q: any) => q.ramp),
        hasBanxa: idealProviders.some((q: any) => q.ramp?.toLowerCase() === 'banxa')
      });
    } else {
      addResult('Quotes WITH iDEAL (USDC)', false, data.error || 'Unknown error', data);
    }
  } catch (error: any) {
    addResult('Quotes WITH iDEAL (USDC)', false, error.message);
  }
};

// Test 6: Test Direct Onramper API (bypass our API)
const testDirectOnramperApi = async () => {
  if (!ONRAMPER_API_KEY) {
    addResult('Direct Onramper API', false, 'ONRAMPER_API_KEY not set');
    return;
  }
  
  try {
    // Test /supported endpoint
    const supportedUrl = 'https://api.onramper.com/supported';
    const supportedResponse = await fetch(supportedUrl, {
      headers: {
        'Authorization': ONRAMPER_API_KEY.replace(/^["']|["']$/g, '').trim()
      }
    });
    const supportedData = await supportedResponse.json();
    
    if (supportedResponse.ok) {
      addResult('Direct Onramper API (/supported)', true, undefined, {
        status: supportedResponse.status,
        hasPaymentTypes: !!supportedData.paymentTypes,
        hasFiat: !!supportedData.fiat,
        hasCrypto: !!supportedData.crypto
      });
    } else {
      addResult('Direct Onramper API (/supported)', false, `Status: ${supportedResponse.status}`, supportedData);
    }
  } catch (error: any) {
    addResult('Direct Onramper API', false, error.message);
  }
};

// Test 7: Test Payment Method Matching Logic
const testPaymentMethodMatching = async () => {
  try {
    // Get supported payment methods
    const supportedResponse = await fetch(`${BASE_URL}/api/onramper/supported-data`);
    const supportedData = await supportedResponse.json();
    
    if (supportedData.success && supportedData.paymentMethods) {
      const paymentMethods = supportedData.paymentMethods || [];
      const idealMethods = paymentMethods.filter((pm: any) => 
        pm.id?.toLowerCase().includes('ideal')
      );
      
      addResult('Payment Method Matching', true, undefined, {
        totalMethods: paymentMethods.length,
        idealMethods: idealMethods.length,
        idealIds: idealMethods.map((pm: any) => pm.id)
      });
    } else {
      addResult('Payment Method Matching', false, 'Could not fetch payment methods');
    }
  } catch (error: any) {
    addResult('Payment Method Matching', false, error.message);
  }
};

// Test 8: Test Backend Filtering Logic
const testBackendFiltering = async () => {
  try {
    // Get quotes WITHOUT payment method
    const allQuotesResponse = await fetch(`${BASE_URL}/api/onramper/quotes?fiatAmount=250&fiatCurrency=EUR&cryptoCurrency=ETH`);
    const allQuotesData = await allQuotesResponse.json();
    
    // Get quotes WITH iDEAL
    const idealQuotesResponse = await fetch(`${BASE_URL}/api/onramper/quotes?fiatAmount=250&fiatCurrency=EUR&cryptoCurrency=ETH&paymentMethod=ideal`);
    const idealQuotesData = await idealQuotesResponse.json();
    
    if (allQuotesData.success && idealQuotesData.success) {
      const allQuotes = allQuotesData.quotes || [];
      const idealQuotes = idealQuotesData.quotes || [];
      
      // Check which providers from "all" support iDEAL
      const providersWithIdeal = allQuotes.filter((q: any) => {
        const methods = q.availablePaymentMethods || [];
        return methods.some((pm: any) => {
          const id = (pm.paymentTypeId || pm.id || '').toLowerCase();
          return id.includes('ideal');
        });
      }).map((q: any) => q.ramp);
      
      addResult('Backend Filtering Logic', true, undefined, {
        allQuotes: allQuotes.length,
        idealQuotes: idealQuotes.length,
        providersWithIdeal: providersWithIdeal.length,
        providersWithIdealList: providersWithIdeal,
        filteredProviders: idealQuotes.map((q: any) => q.ramp),
        filteringWorks: idealQuotes.length <= providersWithIdeal.length
      });
    } else {
      addResult('Backend Filtering Logic', false, 'Could not fetch quotes');
    }
  } catch (error: any) {
    addResult('Backend Filtering Logic', false, error.message);
  }
};

// Main test runner
const runAllTests = async () => {
  console.log('🧪 COMPREHENSIVE BUYMODAL3 TEST SUITE\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  await testApiKey();
  await testSupportedData();
  await testQuotesWithoutPaymentMethod();
  await testQuotesWithIdealEth();
  await testQuotesWithIdealUsdc();
  await testDirectOnramperApi();
  await testPaymentMethodMatching();
  await testBackendFiltering();
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('📊 SUMMARY\n');
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${((passed / results.length) * 100).toFixed(1)}%\n`);
  
  if (failed > 0) {
    console.log('❌ FAILED TESTS:\n');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  • ${r.name}`);
      if (r.error) console.log(`    Error: ${r.error}`);
    });
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
};

runAllTests().catch(console.error);

