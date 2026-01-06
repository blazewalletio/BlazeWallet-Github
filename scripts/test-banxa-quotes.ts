/**
 * Test script to understand BANXA quote structure for iDEAL
 * This helps us understand why quotes aren't showing in the UI
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const ONRAMPER_API_KEY = process.env.ONRAMPER_API_KEY?.trim().replace(/^["']|["']$/g, '') || '';

async function testBanxaQuotes() {
  console.log('🧪 Testing BANXA quotes for iDEAL...\n');

  if (!ONRAMPER_API_KEY) {
    console.error('❌ ONRAMPER_API_KEY not found in .env.local');
    return;
  }

  const fiatAmount = 250;
  const fiatCurrency = 'EUR';
  const cryptoCurrency = 'SOL';
  const paymentMethod = 'ideal';

  const url = `https://api.onramper.com/quotes/${fiatCurrency.toLowerCase()}/${cryptoCurrency.toLowerCase()}?amount=${fiatAmount}&paymentMethod=${paymentMethod}`;

  console.log('📡 Request URL:', url);
  console.log('📡 Payment Method:', paymentMethod);
  console.log('');

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': ONRAMPER_API_KEY,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', response.status, response.statusText);
      console.error('Response:', errorText);
      return;
    }

    const quotes = await response.json();
    console.log(`✅ Received ${quotes.length} quotes\n`);

    // Find BANXA quote
    const banxaQuote = quotes.find((q: any) => q.ramp?.toLowerCase() === 'banxa');

    if (!banxaQuote) {
      console.error('❌ BANXA quote not found in response');
      console.log('Available providers:', quotes.map((q: any) => q.ramp));
      return;
    }

    console.log('🔍 BANXA Quote Structure:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(JSON.stringify(banxaQuote, null, 2));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('📊 Key Fields:');
    console.log(`  ramp: ${banxaQuote.ramp}`);
    console.log(`  paymentMethod: ${banxaQuote.paymentMethod}`);
    console.log(`  payout: ${banxaQuote.payout ?? 'MISSING'}`);
    console.log(`  rate: ${banxaQuote.rate ?? 'MISSING'}`);
    console.log(`  networkFee: ${banxaQuote.networkFee ?? 'MISSING'}`);
    console.log(`  transactionFee: ${banxaQuote.transactionFee ?? 'MISSING'}`);
    console.log(`  errors: ${banxaQuote.errors ? JSON.stringify(banxaQuote.errors, null, 2) : 'NONE'}`);
    console.log(`  availablePaymentMethods: ${banxaQuote.availablePaymentMethods ? JSON.stringify(banxaQuote.availablePaymentMethods, null, 2) : 'MISSING'}`);
    console.log('');

    // Check if we can create a valid quote from this
    if (banxaQuote.payout) {
      console.log('✅ BANXA has payout - can create quote');
      const quote = {
        cryptoAmount: banxaQuote.payout.toString(),
        exchangeRate: banxaQuote.rate?.toString() || '0',
        fee: ((banxaQuote.networkFee || 0) + (banxaQuote.transactionFee || 0)).toString(),
        totalAmount: fiatAmount.toString(),
        baseCurrency: fiatCurrency,
        quoteCurrency: cryptoCurrency,
      };
      console.log('📝 Created Quote:', quote);
    } else {
      console.log('⚠️ BANXA has NO payout - cannot create quote with actual values');
      console.log('   This is why the quote shows 0.000000 SOL');
      console.log('');
      console.log('💡 Solution:');
      console.log('   1. Try fetching quote without paymentMethod filter');
      console.log('   2. Or fetch quote for a different crypto (ETH instead of SOL)');
      console.log('   3. Or show a message that quote will be calculated during checkout');
    }

    // Test other providers that might have payout
    console.log('\n🔍 Checking other providers for payout:');
    const providersWithPayout = quotes.filter((q: any) => q.payout && !q.errors?.length);
    const providersWithoutPayout = quotes.filter((q: any) => !q.payout || q.errors?.length);

    console.log(`  ✅ Providers WITH payout: ${providersWithPayout.length}`);
    providersWithPayout.forEach((q: any) => {
      console.log(`     - ${q.ramp}: ${q.payout} ${cryptoCurrency}`);
    });

    console.log(`  ⚠️ Providers WITHOUT payout: ${providersWithoutPayout.length}`);
    providersWithoutPayout.slice(0, 5).forEach((q: any) => {
      console.log(`     - ${q.ramp}: ${q.errors ? q.errors[0]?.message : 'no payout'}`);
    });

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

// Run test
testBanxaQuotes();

