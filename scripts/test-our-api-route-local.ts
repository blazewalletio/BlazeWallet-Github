/**
 * 🧪 TEST: Our API route locally
 * 
 * Test what our API route returns for iDeal | Wero
 * Run: npx tsx scripts/test-our-api-route-local.ts
 * 
 * NOTE: Make sure dev server is running (npm run dev)
 */

const BASE_URL = 'http://localhost:3000';

async function testOurApiRoute() {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🧪 TEST: Our API Route (Local)`);
  console.log(`${'='.repeat(80)}\n`);
  
  const fiatAmount = 250;
  const fiatCurrency = 'EUR';
  const cryptoCurrency = 'ETH';
  const paymentMethod = 'ideal';
  
  const url = `${BASE_URL}/api/onramper/quotes?fiatAmount=${fiatAmount}&fiatCurrency=${fiatCurrency}&cryptoCurrency=${cryptoCurrency}&paymentMethod=${paymentMethod}`;
  
  console.log(`📡 Testing our API route:`);
  console.log(`   URL: ${url}\n`);
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    console.log(`📊 Response Status: ${response.status}`);
    console.log(`📊 Response Success: ${data.success}`);
    console.log(`📊 Quotes Count: ${data.quotes?.length || 0}`);
    console.log(`📊 Payment Method: ${data.paymentMethod || 'none'}\n`);
    
    if (data.quotes && data.quotes.length > 0) {
      console.log(`✅ Quotes received:\n`);
      data.quotes.forEach((q: any, idx: number) => {
        console.log(`   ${idx + 1}. ${q.ramp}`);
        console.log(`      Payment Method: ${q.paymentMethod || 'none'}`);
        console.log(`      Has Errors: ${!!(q.errors && q.errors.length > 0)}`);
        if (q.errors && q.errors.length > 0) {
          console.log(`      Errors:`, q.errors.map((e: any) => e.message || e.type).join(', '));
        }
        console.log(`      Available Methods:`, q.availablePaymentMethods?.map((pm: any) => {
          const id = pm.paymentTypeId || pm.id || '';
          return id;
        }).join(', ') || 'none');
        console.log(`      Payout: ${q.payout || 'N/A'}`);
        console.log('');
      });
      
      const banxaQuote = data.quotes.find((q: any) => q.ramp?.toLowerCase() === 'banxa');
      if (banxaQuote) {
        console.log(`✅ BANXA found in API response!`);
      } else {
        console.log(`❌ BANXA NOT found in API response`);
      }
    } else {
      console.log(`❌ No quotes returned from API`);
      console.log(`   Error: ${data.error || 'none'}`);
      console.log(`   Message: ${data.message || 'none'}`);
    }
    
  } catch (error: any) {
    console.log(`❌ Error: ${error.message}`);
    if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
      console.log(`   Note: Make sure the dev server is running (npm run dev)`);
    }
  }
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`✅ TEST COMPLETED`);
  console.log(`${'='.repeat(80)}\n`);
}

testOurApiRoute().catch(console.error);

