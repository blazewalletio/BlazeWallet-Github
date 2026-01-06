/**
 * Test our API route to see what quotes structure we get back
 * This helps us understand why payout might be missing in the UI
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function testOurApiRoute() {
  console.log('🧪 Testing our /api/onramper/quotes route...\n');

  const fiatAmount = 250;
  const fiatCurrency = 'EUR';
  const cryptoCurrency = 'SOL';
  const paymentMethod = 'ideal';

  const url = `http://localhost:3000/api/onramper/quotes?fiatAmount=${fiatAmount}&fiatCurrency=${fiatCurrency}&cryptoCurrency=${cryptoCurrency}&paymentMethod=${paymentMethod}`;

  console.log('📡 Request URL:', url);
  console.log('');

  try {
    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', response.status, response.statusText);
      console.error('Response:', errorText);
      return;
    }

    const data = await response.json();
    console.log(`✅ Response received\n`);
    console.log(`  success: ${data.success}`);
    console.log(`  quoteCount: ${data.quoteCount}`);
    console.log(`  requestedPaymentMethod: ${data.requestedPaymentMethod}`);
    console.log(`  responsePaymentMethod: ${data.responsePaymentMethod}`);
    console.log(`  quotes.length: ${data.quotes?.length || 0}\n`);

    // Find BANXA quote
    const banxaQuote = data.quotes?.find((q: any) => q.ramp?.toLowerCase() === 'banxa');

    if (!banxaQuote) {
      console.error('❌ BANXA quote not found in response');
      console.log('Available providers:', data.quotes?.map((q: any) => q.ramp) || []);
      return;
    }

    console.log('🔍 BANXA Quote from our API route:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(JSON.stringify(banxaQuote, null, 2));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('📊 Key Fields:');
    console.log(`  ramp: ${banxaQuote.ramp}`);
    console.log(`  paymentMethod: ${banxaQuote.paymentMethod}`);
    console.log(`  payout: ${banxaQuote.payout ?? 'MISSING ⚠️'}`);
    console.log(`  rate: ${banxaQuote.rate ?? 'MISSING ⚠️'}`);
    console.log(`  networkFee: ${banxaQuote.networkFee ?? 'MISSING ⚠️'}`);
    console.log(`  transactionFee: ${banxaQuote.transactionFee ?? 'MISSING ⚠️'}`);
    console.log(`  errors: ${banxaQuote.errors ? JSON.stringify(banxaQuote.errors, null, 2) : 'NONE'}`);
    console.log('');

    if (banxaQuote.payout) {
      console.log('✅ BANXA has payout in our API response - quote should work!');
    } else {
      console.log('❌ BANXA has NO payout in our API response - this is the problem!');
      console.log('   The payout field is being lost somewhere in our API route');
    }

    // Check a few other providers
    console.log('\n🔍 Checking other providers for payout:');
    const providersWithPayout = data.quotes?.filter((q: any) => q.payout) || [];
    const providersWithoutPayout = data.quotes?.filter((q: any) => !q.payout) || [];

    console.log(`  ✅ Providers WITH payout: ${providersWithPayout.length}`);
    providersWithPayout.slice(0, 3).forEach((q: any) => {
      console.log(`     - ${q.ramp}: ${q.payout} ${cryptoCurrency}`);
    });

    console.log(`  ⚠️ Providers WITHOUT payout: ${providersWithoutPayout.length}`);
    providersWithoutPayout.slice(0, 3).forEach((q: any) => {
      console.log(`     - ${q.ramp}: ${q.errors ? q.errors[0]?.message : 'no payout'}`);
    });

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

// Run test
testOurApiRoute();

