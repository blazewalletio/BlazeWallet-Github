// Test payment method availability check (like BuyModal3 does)

async function testAvailability() {
  const fiatCurrency = 'EUR';
  const crypto = 'SOL';
  const paymentMethods = ['creditcard', 'applepay', 'googlepay', 'ideal', 'bancontact', 'sepa'];
  
  console.log(`🔍 Testing payment method availability for ${crypto}...\n`);
  
  for (const pm of paymentMethods) {
    try {
      const url = `http://localhost:3000/api/onramper/quotes?fiatAmount=250&fiatCurrency=${fiatCurrency}&cryptoCurrency=${crypto}&paymentMethod=${pm}`;
      console.log(`📊 Testing ${pm}...`);
      console.log(`   URL: ${url}`);
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success && Array.isArray(data.quotes) && data.quotes.length > 0) {
        console.log(`   ✅ ${pm}: ${data.quotes.length} providers available`);
        console.log(`   Providers: ${data.quotes.map(q => q.ramp).join(', ')}`);
      } else {
        console.log(`   ⚠️  ${pm}: 0 providers (not available for ${crypto})`);
        if (data.quotes && data.quotes.length > 0) {
          console.log(`   Debug: Got ${data.quotes.length} quotes but all have errors`);
        }
      }
      console.log('');
      
      // Small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 300));
      
    } catch (error) {
      console.error(`   ❌ ${pm}: Error:`, error.message);
      console.log('');
    }
  }
}

testAvailability();
