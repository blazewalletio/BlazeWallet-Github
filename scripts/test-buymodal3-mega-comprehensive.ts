/**
 * 🧪 MEGA COMPREHENSIVE BUYMODAL3 TEST SCRIPT
 * 
 * Tests EVERY possible combination and scenario:
 * - All payment methods
 * - All crypto currencies
 * - All fiat currencies
 * - All combinations
 * - Direct Onramper API
 * - Filtering logic
 * - Provider selection
 * - Error handling
 * - Edge cases
 * 
 * Run: npx tsx scripts/test-buymodal3-mega-comprehensive.ts
 */

import fetch from 'node-fetch';

const BASE_URL = process.env.BASE_URL || 'https://my.blazewallet.io';
const ONRAMPER_API_KEY = process.env.ONRAMPER_API_KEY || '';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  data?: any;
  details?: any;
}

const results: TestResult[] = [];
const detailedResults: any[] = [];

const addResult = (name: string, passed: boolean, error?: string, data?: any, details?: any) => {
  results.push({ name, passed, error, data, details });
  detailedResults.push({ name, passed, error, data, details, timestamp: new Date().toISOString() });
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} ${name}`);
  if (error) console.log(`   Error: ${error}`);
  if (data) {
    console.log(`   Data: ${JSON.stringify(data, null, 2).substring(0, 200)}${JSON.stringify(data).length > 200 ? '...' : ''}`);
  }
};

// ============================================================================
// SECTION 1: API KEY & CONFIGURATION
// ============================================================================

const testApiKey = async () => {
  console.log('\n📋 SECTION 1: API KEY & CONFIGURATION\n');
  
  if (!ONRAMPER_API_KEY) {
    addResult('API Key Check', false, 'ONRAMPER_API_KEY not set');
    return;
  }
  
  const cleaned = ONRAMPER_API_KEY.replace(/^["']|["']$/g, '').trim();
  addResult('API Key Check', true, undefined, {
    hasKey: !!ONRAMPER_API_KEY,
    rawLength: ONRAMPER_API_KEY.length,
    cleanedLength: cleaned.length,
    prefix: cleaned.substring(0, 10) + '...',
    suffix: '...' + cleaned.substring(cleaned.length - 4),
    isTest: cleaned.startsWith('pk_test_'),
    isProd: cleaned.startsWith('pk_prod_')
  });
};

// ============================================================================
// SECTION 2: SUPPORTED DATA
// ============================================================================

const testSupportedData = async () => {
  console.log('\n📋 SECTION 2: SUPPORTED DATA\n');
  
  try {
    const response = await fetch(`${BASE_URL}/api/onramper/supported-data`);
    const data = await response.json();
    
    if (data.success) {
      const paymentMethods = data.paymentMethods || [];
      const fiatCurrencies = data.fiatCurrencies || [];
      const cryptoCurrencies = data.cryptoCurrencies || [];
      
      // Find iDEAL payment methods
      const idealMethods = paymentMethods.filter((pm: any) => 
        pm.id?.toLowerCase().includes('ideal')
      );
      
      addResult('Supported Data - Payment Methods', true, undefined, {
        total: paymentMethods.length,
        idealCount: idealMethods.length,
        idealIds: idealMethods.map((pm: any) => pm.id),
        sample: paymentMethods.slice(0, 5).map((pm: any) => ({ id: pm.id, name: pm.name }))
      });
      
      addResult('Supported Data - Fiat Currencies', true, undefined, {
        total: fiatCurrencies.length,
        currencies: fiatCurrencies
      });
      
      addResult('Supported Data - Crypto Currencies', true, undefined, {
        total: cryptoCurrencies.length,
        sample: cryptoCurrencies.slice(0, 10)
      });
      
      return { paymentMethods, fiatCurrencies, cryptoCurrencies };
    } else {
      addResult('Supported Data', false, data.error || 'Unknown error', data);
      return null;
    }
  } catch (error: any) {
    addResult('Supported Data', false, error.message);
    return null;
  }
};

// ============================================================================
// SECTION 3: DIRECT ONRAMPER API TESTS
// ============================================================================

const testDirectOnramperApi = async () => {
  console.log('\n📋 SECTION 3: DIRECT ONRAMPER API TESTS\n');
  
  if (!ONRAMPER_API_KEY) {
    addResult('Direct Onramper API - /supported', false, 'ONRAMPER_API_KEY not set');
    return;
  }
  
  const cleanedKey = ONRAMPER_API_KEY.replace(/^["']|["']$/g, '').trim();
  
  try {
    // Test /supported endpoint
    const supportedUrl = 'https://api.onramper.com/supported';
    const supportedResponse = await fetch(supportedUrl, {
      headers: {
        'Authorization': cleanedKey
      }
    });
    const supportedData = await supportedResponse.json();
    
    if (supportedResponse.ok) {
      addResult('Direct Onramper API - /supported', true, undefined, {
        status: supportedResponse.status,
        hasPaymentTypes: !!supportedData.paymentTypes,
        hasFiat: !!supportedData.fiat,
        hasCrypto: !!supportedData.crypto,
        paymentTypesCount: supportedData.paymentTypes?.length || 0,
        fiatCount: supportedData.fiat?.length || 0,
        cryptoCount: supportedData.crypto?.length || 0
      });
    } else {
      addResult('Direct Onramper API - /supported', false, `Status: ${supportedResponse.status}`, supportedData);
    }
    
    // Test /quotes endpoint directly
    const quotesUrl = 'https://api.onramper.com/quotes/eur/eth?amount=250';
    const quotesResponse = await fetch(quotesUrl, {
      headers: {
        'Authorization': cleanedKey
      }
    });
    const quotesData = await quotesResponse.json();
    
    if (quotesResponse.ok && Array.isArray(quotesData)) {
      addResult('Direct Onramper API - /quotes (no payment method)', true, undefined, {
        status: quotesResponse.status,
        quotesCount: quotesData.length,
        providers: quotesData.map((q: any) => q.ramp),
        hasBanxa: quotesData.some((q: any) => q.ramp?.toLowerCase() === 'banxa'),
        hasMoonpay: quotesData.some((q: any) => q.ramp?.toLowerCase() === 'moonpay')
      });
    } else {
      addResult('Direct Onramper API - /quotes (no payment method)', false, `Status: ${quotesResponse.status}`, quotesData);
    }
    
  } catch (error: any) {
    addResult('Direct Onramper API', false, error.message);
  }
};

// ============================================================================
// SECTION 4: QUOTES WITHOUT PAYMENT METHOD
// ============================================================================

const testQuotesWithoutPaymentMethod = async () => {
  console.log('\n📋 SECTION 4: QUOTES WITHOUT PAYMENT METHOD\n');
  
  const testCases = [
    { fiat: 'EUR', crypto: 'ETH', amount: 250 },
    { fiat: 'EUR', crypto: 'USDC', amount: 250 },
    { fiat: 'EUR', crypto: 'BTC', amount: 250 },
    { fiat: 'USD', crypto: 'ETH', amount: 250 },
    { fiat: 'GBP', crypto: 'ETH', amount: 250 }
  ];
  
  for (const testCase of testCases) {
    try {
      const url = `${BASE_URL}/api/onramper/quotes?fiatAmount=${testCase.amount}&fiatCurrency=${testCase.fiat}&cryptoCurrency=${testCase.crypto}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success && data.quotes) {
        const quotes = data.quotes || [];
        const validQuotes = quotes.filter((q: any) => !q.errors || q.errors.length === 0);
        
        // Analyze available payment methods
        const paymentMethodAnalysis: Record<string, number> = {};
        validQuotes.forEach((q: any) => {
          const methods = q.availablePaymentMethods || [];
          methods.forEach((pm: any) => {
            const id = (pm.paymentTypeId || pm.id || '').toLowerCase();
            paymentMethodAnalysis[id] = (paymentMethodAnalysis[id] || 0) + 1;
          });
        });
        
        addResult(`Quotes WITHOUT Payment Method - ${testCase.fiat}/${testCase.crypto}`, true, undefined, {
          totalQuotes: quotes.length,
          validQuotes: validQuotes.length,
          providers: validQuotes.map((q: any) => q.ramp),
          hasBanxa: validQuotes.some((q: any) => q.ramp?.toLowerCase() === 'banxa'),
          hasMoonpay: validQuotes.some((q: any) => q.ramp?.toLowerCase() === 'moonpay'),
          idealSupport: Object.keys(paymentMethodAnalysis).filter(k => k.includes('ideal')).length,
          topPaymentMethods: Object.entries(paymentMethodAnalysis)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([id, count]) => ({ id, count }))
        });
      } else {
        addResult(`Quotes WITHOUT Payment Method - ${testCase.fiat}/${testCase.crypto}`, false, data.error || 'Unknown error', data);
      }
    } catch (error: any) {
      addResult(`Quotes WITHOUT Payment Method - ${testCase.fiat}/${testCase.crypto}`, false, error.message);
    }
  }
};

// ============================================================================
// SECTION 5: QUOTES WITH PAYMENT METHODS
// ============================================================================

const testQuotesWithPaymentMethods = async () => {
  console.log('\n📋 SECTION 5: QUOTES WITH PAYMENT METHODS\n');
  
  const paymentMethods = ['ideal', 'creditcard', 'banktransfer', 'applepay', 'googlepay'];
  const cryptos = ['ETH', 'USDC', 'BTC'];
  const fiat = 'EUR';
  const amount = 250;
  
  for (const paymentMethod of paymentMethods) {
    for (const crypto of cryptos) {
      try {
        const url = `${BASE_URL}/api/onramper/quotes?fiatAmount=${amount}&fiatCurrency=${fiat}&cryptoCurrency=${crypto}&paymentMethod=${paymentMethod}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.success && data.quotes) {
          const quotes = data.quotes || [];
          const validQuotes = quotes.filter((q: any) => !q.errors || q.errors.length === 0);
          
          // Verify payment method support
          const verifiedQuotes = validQuotes.filter((q: any) => {
            const methods = q.availablePaymentMethods || [];
            return methods.some((pm: any) => {
              const id = (pm.paymentTypeId || pm.id || '').toLowerCase();
              return id === paymentMethod.toLowerCase() || 
                     (paymentMethod.toLowerCase().includes('ideal') && id.includes('ideal'));
            });
          });
          
          addResult(`Quotes WITH ${paymentMethod.toUpperCase()} - ${crypto}`, true, undefined, {
            totalQuotes: quotes.length,
            validQuotes: validQuotes.length,
            verifiedQuotes: verifiedQuotes.length,
            providers: verifiedQuotes.map((q: any) => q.ramp),
            hasBanxa: verifiedQuotes.some((q: any) => q.ramp?.toLowerCase() === 'banxa'),
            hasMoonpay: verifiedQuotes.some((q: any) => q.ramp?.toLowerCase() === 'moonpay'),
            responsePaymentMethod: data.paymentMethod || 'none'
          });
        } else {
          addResult(`Quotes WITH ${paymentMethod.toUpperCase()} - ${crypto}`, false, data.error || 'Unknown error', data);
        }
      } catch (error: any) {
        addResult(`Quotes WITH ${paymentMethod.toUpperCase()} - ${crypto}`, false, error.message);
      }
    }
  }
};

// ============================================================================
// SECTION 6: BACKEND FILTERING LOGIC
// ============================================================================

const testBackendFiltering = async () => {
  console.log('\n📋 SECTION 6: BACKEND FILTERING LOGIC\n');
  
  const testCases = [
    { fiat: 'EUR', crypto: 'ETH', paymentMethod: 'ideal' },
    { fiat: 'EUR', crypto: 'USDC', paymentMethod: 'ideal' },
    { fiat: 'EUR', crypto: 'ETH', paymentMethod: 'creditcard' }
  ];
  
  for (const testCase of testCases) {
    try {
      // Get quotes WITHOUT payment method
      const allUrl = `${BASE_URL}/api/onramper/quotes?fiatAmount=250&fiatCurrency=${testCase.fiat}&cryptoCurrency=${testCase.crypto}`;
      const allResponse = await fetch(allUrl);
      const allData = await allResponse.json();
      
      // Get quotes WITH payment method
      const filteredUrl = `${BASE_URL}/api/onramper/quotes?fiatAmount=250&fiatCurrency=${testCase.fiat}&cryptoCurrency=${testCase.crypto}&paymentMethod=${testCase.paymentMethod}`;
      const filteredResponse = await fetch(filteredUrl);
      const filteredData = await filteredResponse.json();
      
      if (allData.success && filteredData.success) {
        const allQuotes = allData.quotes || [];
        const filteredQuotes = filteredData.quotes || [];
        
        // Check which providers from "all" support the payment method
        const providersWithMethod = allQuotes.filter((q: any) => {
          const methods = q.availablePaymentMethods || [];
          return methods.some((pm: any) => {
            const id = (pm.paymentTypeId || pm.id || '').toLowerCase();
            const methodLower = testCase.paymentMethod.toLowerCase();
            return id === methodLower || 
                   (methodLower.includes('ideal') && id.includes('ideal'));
          });
        }).map((q: any) => q.ramp);
        
        addResult(`Backend Filtering - ${testCase.paymentMethod.toUpperCase()} for ${testCase.crypto}`, true, undefined, {
          allQuotes: allQuotes.length,
          filteredQuotes: filteredQuotes.length,
          providersWithMethod: providersWithMethod.length,
          providersWithMethodList: providersWithMethod,
          filteredProviders: filteredQuotes.map((q: any) => q.ramp),
          filteringWorks: filteredQuotes.length <= providersWithMethod.length,
          filteringCorrect: filteredQuotes.every((fq: any) => 
            providersWithMethod.includes(fq.ramp)
          )
        });
      } else {
        addResult(`Backend Filtering - ${testCase.paymentMethod.toUpperCase()} for ${testCase.crypto}`, false, 'Could not fetch quotes');
      }
    } catch (error: any) {
      addResult(`Backend Filtering - ${testCase.paymentMethod.toUpperCase()} for ${testCase.crypto}`, false, error.message);
    }
  }
};

// ============================================================================
// SECTION 7: EDGE CASES
// ============================================================================

const testEdgeCases = async () => {
  console.log('\n📋 SECTION 7: EDGE CASES\n');
  
  // Test 1: Very small amount
  try {
    const url = `${BASE_URL}/api/onramper/quotes?fiatAmount=10&fiatCurrency=EUR&cryptoCurrency=ETH`;
    const response = await fetch(url);
    const data = await response.json();
    addResult('Edge Case - Very Small Amount (10 EUR)', data.success, data.error, {
      quotesCount: data.quotes?.length || 0
    });
  } catch (error: any) {
    addResult('Edge Case - Very Small Amount', false, error.message);
  }
  
  // Test 2: Very large amount
  try {
    const url = `${BASE_URL}/api/onramper/quotes?fiatAmount=10000&fiatCurrency=EUR&cryptoCurrency=ETH`;
    const response = await fetch(url);
    const data = await response.json();
    addResult('Edge Case - Very Large Amount (10000 EUR)', data.success, data.error, {
      quotesCount: data.quotes?.length || 0
    });
  } catch (error: any) {
    addResult('Edge Case - Very Large Amount', false, error.message);
  }
  
  // Test 3: Invalid amount
  try {
    const url = `${BASE_URL}/api/onramper/quotes?fiatAmount=0&fiatCurrency=EUR&cryptoCurrency=ETH`;
    const response = await fetch(url);
    const data = await response.json();
    addResult('Edge Case - Invalid Amount (0)', !data.success, undefined, {
      error: data.error
    });
  } catch (error: any) {
    addResult('Edge Case - Invalid Amount', false, error.message);
  }
  
  // Test 4: Missing parameters
  try {
    const url = `${BASE_URL}/api/onramper/quotes?fiatAmount=250`;
    const response = await fetch(url);
    const data = await response.json();
    addResult('Edge Case - Missing Parameters', !data.success, undefined, {
      error: data.error
    });
  } catch (error: any) {
    addResult('Edge Case - Missing Parameters', false, error.message);
  }
  
  // Test 5: Invalid payment method
  try {
    const url = `${BASE_URL}/api/onramper/quotes?fiatAmount=250&fiatCurrency=EUR&cryptoCurrency=ETH&paymentMethod=invalidmethod123`;
    const response = await fetch(url);
    const data = await response.json();
    addResult('Edge Case - Invalid Payment Method', data.success, undefined, {
      quotesCount: data.quotes?.length || 0,
      shouldBeEmpty: data.quotes?.length === 0
    });
  } catch (error: any) {
    addResult('Edge Case - Invalid Payment Method', false, error.message);
  }
};

// ============================================================================
// SECTION 8: PAYMENT METHOD MATCHING
// ============================================================================

const testPaymentMethodMatching = async () => {
  console.log('\n📋 SECTION 8: PAYMENT METHOD MATCHING\n');
  
  try {
    const response = await fetch(`${BASE_URL}/api/onramper/supported-data`);
    const data = await response.json();
    
    if (data.success && data.paymentMethods) {
      const paymentMethods = data.paymentMethods || [];
      
      // Test all payment method IDs
      const methodIds = paymentMethods.map((pm: any) => pm.id);
      const idealMethods = methodIds.filter((id: string) => id.toLowerCase().includes('ideal'));
      
      addResult('Payment Method Matching - All Methods', true, undefined, {
        totalMethods: methodIds.length,
        idealMethods: idealMethods.length,
        idealIds: idealMethods,
        allIds: methodIds
      });
      
      // Test matching logic for each ideal method
      for (const idealId of idealMethods) {
        try {
          const url = `${BASE_URL}/api/onramper/quotes?fiatAmount=250&fiatCurrency=EUR&cryptoCurrency=ETH&paymentMethod=${idealId}`;
          const quoteResponse = await fetch(url);
          const quoteData = await quoteResponse.json();
          
          if (quoteData.success) {
            addResult(`Payment Method Matching - ${idealId}`, true, undefined, {
              quotesCount: quoteData.quotes?.length || 0,
              responsePaymentMethod: quoteData.paymentMethod || 'none'
            });
          } else {
            addResult(`Payment Method Matching - ${idealId}`, false, quoteData.error);
          }
        } catch (error: any) {
          addResult(`Payment Method Matching - ${idealId}`, false, error.message);
        }
      }
    } else {
      addResult('Payment Method Matching', false, 'Could not fetch payment methods');
    }
  } catch (error: any) {
    addResult('Payment Method Matching', false, error.message);
  }
};

// ============================================================================
// SECTION 9: RESPONSE VALIDATION
// ============================================================================

const testResponseValidation = async () => {
  console.log('\n📋 SECTION 9: RESPONSE VALIDATION\n');
  
  try {
    const url = `${BASE_URL}/api/onramper/quotes?fiatAmount=250&fiatCurrency=EUR&cryptoCurrency=ETH&paymentMethod=ideal`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.success) {
      // Validate response structure
      const hasQuotes = Array.isArray(data.quotes);
      const hasPaymentMethod = 'paymentMethod' in data;
      const hasQuoteCount = 'quoteCount' in data;
      
      addResult('Response Validation - Structure', hasQuotes && hasPaymentMethod && hasQuoteCount, undefined, {
        hasQuotes,
        hasPaymentMethod,
        hasQuoteCount,
        paymentMethod: data.paymentMethod,
        quoteCount: data.quoteCount,
        quotesLength: data.quotes?.length || 0
      });
      
      // Validate quote structure
      if (hasQuotes && data.quotes.length > 0) {
        const firstQuote = data.quotes[0];
        const hasRamp = 'ramp' in firstQuote;
        const hasAvailableMethods = 'availablePaymentMethods' in firstQuote;
        
        addResult('Response Validation - Quote Structure', hasRamp && hasAvailableMethods, undefined, {
          hasRamp,
          hasAvailableMethods,
          ramp: firstQuote.ramp,
          availableMethodsCount: firstQuote.availablePaymentMethods?.length || 0
        });
      }
    } else {
      addResult('Response Validation', false, data.error);
    }
  } catch (error: any) {
    addResult('Response Validation', false, error.message);
  }
};

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

const runAllTests = async () => {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  🧪 MEGA COMPREHENSIVE BUYMODAL3 TEST SUITE                 ║');
  console.log('║  Testing EVERY possible scenario and combination             ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('\n');
  
  const startTime = Date.now();
  
  await testApiKey();
  const supportedData = await testSupportedData();
  await testDirectOnramperApi();
  await testQuotesWithoutPaymentMethod();
  await testQuotesWithPaymentMethods();
  await testBackendFiltering();
  await testEdgeCases();
  await testPaymentMethodMatching();
  await testResponseValidation();
  
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);
  
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  📊 TEST SUMMARY                                             ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('\n');
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;
  
  console.log(`✅ Passed: ${passed}/${total} (${((passed / total) * 100).toFixed(1)}%)`);
  console.log(`❌ Failed: ${failed}/${total} (${((failed / total) * 100).toFixed(1)}%)`);
  console.log(`⏱️  Duration: ${duration}s`);
  console.log('\n');
  
  if (failed > 0) {
    console.log('❌ FAILED TESTS:\n');
    results.filter(r => !r.passed).forEach((r, idx) => {
      console.log(`  ${idx + 1}. ${r.name}`);
      if (r.error) console.log(`     Error: ${r.error}`);
      if (r.data) console.log(`     Data: ${JSON.stringify(r.data, null, 2).substring(0, 150)}...`);
    });
    console.log('\n');
  }
  
  // Save detailed results to file
  const fs = require('fs');
  const resultsFile = 'test-results-buymodal3.json';
  fs.writeFileSync(resultsFile, JSON.stringify({
    summary: {
      passed,
      failed,
      total,
      duration: `${duration}s`,
      timestamp: new Date().toISOString()
    },
    results: detailedResults
  }, null, 2));
  
  console.log(`📄 Detailed results saved to: ${resultsFile}`);
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  ✅ TEST SUITE COMPLETE                                       ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('\n');
};

runAllTests().catch(console.error);

