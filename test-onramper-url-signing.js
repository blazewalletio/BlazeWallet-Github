/**
 * Test script to verify Onramper URL signing implementation
 * Run: node test-onramper-url-signing.js
 */

const crypto = require('crypto');

const API_KEY = 'pk_prod_01KBJCSS9G727A14XA544DSS7D';

console.log('🧪 Testing Onramper URL Signing...\n');
console.log('API Key:', API_KEY.substring(0, 15) + '...\n');

// Test parameters
const testParams = {
  apiKey: API_KEY,
  onlyCryptos: 'ETH',
  onlyFiats: 'EUR',
  amount: '100',
  wallets: 'ETH:0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
};

console.log('📋 Test Parameters:');
console.log(JSON.stringify(testParams, null, 2));
console.log('\n');

// Method 1: Sign the query string (current implementation)
console.log('🔐 Method 1: Sign query string (current implementation)');
const params1 = new URLSearchParams(testParams);
const queryString1 = params1.toString();
console.log('Query String:', queryString1);

const signature1 = crypto
  .createHmac('sha256', API_KEY)
  .update(queryString1)
  .digest('hex');
console.log('Signature:', signature1);

params1.append('signature', signature1);
const url1 = `https://buy.onramper.com?${params1.toString()}`;
console.log('Final URL:', url1.replace(API_KEY, '***API_KEY***'));
console.log('\n');

// Method 2: Sign query string WITHOUT signature parameter (then add it)
console.log('🔐 Method 2: Sign query string WITHOUT signature, then add signature');
const params2 = new URLSearchParams(testParams);
const queryString2 = params2.toString();
console.log('Query String (without signature):', queryString2);

const signature2 = crypto
  .createHmac('sha256', API_KEY)
  .update(queryString2)
  .digest('hex');
console.log('Signature:', signature2);

params2.append('signature', signature2);
const url2 = `https://buy.onramper.com?${params2.toString()}`;
console.log('Final URL:', url2.replace(API_KEY, '***API_KEY***'));
console.log('\n');

// Method 3: Sign sorted parameters
console.log('🔐 Method 3: Sign sorted parameters');
const sortedKeys = Object.keys(testParams).sort();
const sortedParams = {};
sortedKeys.forEach(key => {
  sortedParams[key] = testParams[key];
});
const params3 = new URLSearchParams(sortedParams);
const queryString3 = params3.toString();
console.log('Sorted Query String:', queryString3);

const signature3 = crypto
  .createHmac('sha256', API_KEY)
  .update(queryString3)
  .digest('hex');
console.log('Signature:', signature3);

params3.append('signature', signature3);
const url3 = `https://buy.onramper.com?${params3.toString()}`;
console.log('Final URL:', url3.replace(API_KEY, '***API_KEY***'));
console.log('\n');

// Method 4: Sign with secret key (if different from API key)
// This would require ONRAMPER_SECRET_KEY environment variable
const secretKey = process.env.ONRAMPER_SECRET_KEY || API_KEY;
if (secretKey !== API_KEY) {
  console.log('🔐 Method 4: Sign with separate secret key');
  const params4 = new URLSearchParams(testParams);
  const queryString4 = params4.toString();
  const signature4 = crypto
    .createHmac('sha256', secretKey)
    .update(queryString4)
    .digest('hex');
  console.log('Signature (with secret key):', signature4);
  params4.append('signature', signature4);
  const url4 = `https://buy.onramper.com?${params4.toString()}`;
  console.log('Final URL:', url4.replace(API_KEY, '***API_KEY***'));
  console.log('\n');
}

// Method 5: Sign the full URL path + query (without domain)
console.log('🔐 Method 5: Sign URL path + query');
const params5 = new URLSearchParams(testParams);
const queryString5 = params5.toString();
const urlPath = `/?${queryString5}`;
console.log('URL Path + Query:', urlPath);

const signature5 = crypto
  .createHmac('sha256', API_KEY)
  .update(urlPath)
  .digest('hex');
console.log('Signature:', signature5);

params5.append('signature', signature5);
const url5 = `https://buy.onramper.com?${params5.toString()}`;
console.log('Final URL:', url5.replace(API_KEY, '***API_KEY***'));
console.log('\n');

// Method 6: Sign only specific parameters (exclude apiKey from signature)
console.log('🔐 Method 6: Sign parameters WITHOUT apiKey');
const params6 = new URLSearchParams();
Object.keys(testParams).forEach(key => {
  if (key !== 'apiKey') {
    params6.append(key, testParams[key]);
  }
});
params6.append('apiKey', API_KEY); // Add apiKey at the end
const queryString6 = params6.toString();
console.log('Query String (apiKey at end):', queryString6);

// Sign without apiKey
const paramsForSigning = new URLSearchParams();
Object.keys(testParams).forEach(key => {
  if (key !== 'apiKey') {
    paramsForSigning.append(key, testParams[key]);
  }
});
const queryStringForSigning = paramsForSigning.toString();
console.log('Query String for signing (no apiKey):', queryStringForSigning);

const signature6 = crypto
  .createHmac('sha256', API_KEY)
  .update(queryStringForSigning)
  .digest('hex');
console.log('Signature:', signature6);

params6.append('signature', signature6);
const url6 = `https://buy.onramper.com?${params6.toString()}`;
console.log('Final URL:', url6.replace(API_KEY, '***API_KEY***'));
console.log('\n');

console.log('✅ All signing methods tested!');
console.log('\n📝 Next steps:');
console.log('1. Check Onramper documentation for exact signing method');
console.log('2. Test each URL in browser to see which one works');
console.log('3. Update implementation based on working method');

