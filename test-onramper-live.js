// Clean API key properly
const API_KEY = (process.env.ONRAMPER_API_KEY || '').trim().replace(/\\n/g, '');

async function testPaymentMethods() {
  console.log('🔍 Testing Onramper API for EUR->SOL payment methods...');
  console.log('API Key length:', API_KEY.length);
  console.log('API Key starts with:', API_KEY.substring(0, 10));
  console.log('');
  
  try {
    // Test 1: Get payment types for EUR->SOL
    console.log('📊 Test 1: GET /supported/payment-types/eur?type=buy&destination=sol');
    const url = 'https://api.onramper.com/supported/payment-types/eur?type=buy&destination=sol';
    const response = await fetch(url, {
      headers: {
        'Authorization': API_KEY,
        'Accept': 'application/json',
      }
    });
    
    console.log('Status:', response.status, response.statusText);
    
    if (response.ok) {
      const data = await response.json();
      console.log('\n✅ Available Payment Methods:');
      console.log('Total:', data.message?.length || 0);
      
      if (data.message) {
        data.message.forEach(pm => {
          console.log(`\n  - ${pm.name} (${pm.paymentTypeId})`);
          console.log(`    Currency Status: ${pm.details?.currencyStatus}`);
          console.log(`    Limits: ${JSON.stringify(pm.details?.limits?.aggregatedLimit)}`);
          console.log(`    Providers:`, Object.keys(pm.details?.limits || {}).filter(k => k !== 'aggregatedLimit').join(', '));
        });
      }
    } else {
      console.log('❌ Error:', await response.text());
    }
    
    // Test 2: Get quote for creditcard
    console.log('\n\n📊 Test 2: GET /quotes/eur/sol with creditcard');
    const quoteUrl = 'https://api.onramper.com/quotes/eur/sol?amount=100&paymentMethod=creditcard&country=nl';
    const quoteResponse = await fetch(quoteUrl, {
      headers: {
        'Authorization': API_KEY,
        'Accept': 'application/json',
      }
    });
    
    console.log('Status:', quoteResponse.status, quoteResponse.statusText);
    
    if (quoteResponse.ok) {
      const data = await quoteResponse.json();
      console.log('✅ Quotes received:', data.message?.length || 0);
    } else {
      console.log('❌ Error:', await quoteResponse.text());
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testPaymentMethods();
