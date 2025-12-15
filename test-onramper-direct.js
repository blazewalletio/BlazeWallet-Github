/**
 * Direct test of Onramper widget URL with different signing methods
 * This will help us identify the correct signing method
 */

const crypto = require('crypto');

const API_KEY = 'pk_prod_01KBJCSS9G727A14XA544DSS7D';

// Test with actual parameters
const testParams = {
  apiKey: API_KEY,
  onlyCryptos: 'ETH',
  onlyFiats: 'EUR',
  amount: '100',
  wallets: 'ETH:0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
};

console.log('🧪 Testing Onramper Widget URL Signing Methods\n');
console.log('='.repeat(80));

// Method 1: Current implementation - sign all params including apiKey
function method1() {
  const params = new URLSearchParams(testParams);
  const queryString = params.toString();
  const signature = crypto.createHmac('sha256', API_KEY).update(queryString).digest('hex');
  params.append('signature', signature);
  return `https://buy.onramper.com?${params.toString()}`;
}

// Method 2: Sign without apiKey in the string to sign
function method2() {
  const params = new URLSearchParams();
  const paramsForSigning = new URLSearchParams();
  
  Object.keys(testParams).forEach(key => {
    if (key !== 'apiKey') {
      params.append(key, testParams[key]);
      paramsForSigning.append(key, testParams[key]);
    }
  });
  params.append('apiKey', API_KEY);
  
  const queryStringForSigning = paramsForSigning.toString();
  const signature = crypto.createHmac('sha256', API_KEY).update(queryStringForSigning).digest('hex');
  params.append('signature', signature);
  return `https://buy.onramper.com?${params.toString()}`;
}

// Method 3: Sign sorted parameters
function method3() {
  const sortedKeys = Object.keys(testParams).sort();
  const params = new URLSearchParams();
  sortedKeys.forEach(key => params.append(key, testParams[key]));
  
  const queryString = params.toString();
  const signature = crypto.createHmac('sha256', API_KEY).update(queryString).digest('hex');
  params.append('signature', signature);
  return `https://buy.onramper.com?${params.toString()}`;
}

// Method 4: Sign with secret key (if different)
// This would require ONRAMPER_SECRET_KEY env var
function method4() {
  const secretKey = process.env.ONRAMPER_SECRET_KEY || API_KEY;
  const params = new URLSearchParams(testParams);
  const queryString = params.toString();
  const signature = crypto.createHmac('sha256', secretKey).update(queryString).digest('hex');
  params.append('signature', signature);
  return `https://buy.onramper.com?${params.toString()}`;
}

// Method 5: Sign URL path + query
function method5() {
  const params = new URLSearchParams(testParams);
  const queryString = params.toString();
  const urlPath = `/?${queryString}`;
  const signature = crypto.createHmac('sha256', API_KEY).update(urlPath).digest('hex');
  params.append('signature', signature);
  return `https://buy.onramper.com?${params.toString()}`;
}

// Method 6: Sign without signature parameter, sorted, apiKey last
function method6() {
  const params = new URLSearchParams();
  const paramsForSigning = new URLSearchParams();
  
  // Add all params except apiKey, sorted
  const keys = Object.keys(testParams).filter(k => k !== 'apiKey').sort();
  keys.forEach(key => {
    params.append(key, testParams[key]);
    paramsForSigning.append(key, testParams[key]);
  });
  
  // Add apiKey at the end
  params.append('apiKey', API_KEY);
  
  const queryStringForSigning = paramsForSigning.toString();
  const signature = crypto.createHmac('sha256', API_KEY).update(queryStringForSigning).digest('hex');
  params.append('signature', signature);
  return `https://buy.onramper.com?${params.toString()}`;
}

// Test all methods
const methods = [
  { name: 'Method 1: Sign all params (current)', fn: method1 },
  { name: 'Method 2: Sign without apiKey', fn: method2 },
  { name: 'Method 3: Sign sorted params', fn: method3 },
  { name: 'Method 4: Sign with secret key', fn: method4 },
  { name: 'Method 5: Sign URL path + query', fn: method5 },
  { name: 'Method 6: Sign sorted without apiKey, apiKey last', fn: method6 },
];

console.log('\n📋 Generated URLs (with masked API key):\n');

methods.forEach((method, index) => {
  try {
    const url = method.fn();
    const maskedUrl = url.replace(API_KEY, '***API_KEY***');
    console.log(`${index + 1}. ${method.name}`);
    console.log(`   URL: ${maskedUrl}`);
    console.log(`   Full URL (for testing): ${url}`);
    console.log('');
  } catch (error) {
    console.log(`${index + 1}. ${method.name} - ERROR: ${error.message}`);
    console.log('');
  }
});

console.log('='.repeat(80));
console.log('\n📝 Instructions:');
console.log('1. Copy each "Full URL" above');
console.log('2. Paste in browser to test');
console.log('3. Check which one works (doesn\'t show "Signature validation failed")');
console.log('4. Update implementation with the working method\n');

console.log('💡 Note: If none work, we may need:');
console.log('   - A separate secret key (ONRAMPER_SECRET_KEY)');
console.log('   - Different signing algorithm');
console.log('   - Contact Onramper support for exact requirements\n');

