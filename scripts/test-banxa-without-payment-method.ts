/**
 * Test BANXA quotes WITHOUT paymentMethod filter
 * This will help us understand if BANXA returns payout/rate when we don't filter by paymentMethod
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const ONRAMPER_API_KEY = process.env.ONRAMPER_API_KEY?.trim().replace(/^["']|["']$/g, '') || '';

async function testBanxaWithoutPaymentMethod() {
  console.log('🧪 Testing BANXA quotes WITHOUT paymentMethod filter...\n');

  const fiatAmount = 250;
  const fiatCurrency = 'EUR';
  const cryptoCurrency = 'SOL';

  // Test 1: WITHOUT paymentMethod filter
  console.log('📊 Test 1: Fetching quotes WITHOUT paymentMethod filter');
  const url1 = `https://api.onramper.com/quotes/${fiatCurrency.toLowerCase()}/${cryptoCurrency.toLowerCase()}?amount=${fiatAmount}`;
  
  console.log(`URL: ${url1}`);
  console.log(`API Key: ${ONRAMPER_API_KEY.substring(0, 10)}...`);

  try {
    const response1 = await fetch(url1, {
      method: 'GET',
      headers: {
        'Authorization': ONRAMPER_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    if (!response1.ok) {
      console.error(`❌ Error: ${response1.status} ${response1.statusText}`);
      const errorText = await response1.text();
      console.error(`Error body: ${errorText}`);
      return;
    }

    const data1 = await response1.json();
    const quotes1 = Array.isArray(data1) ? data1 : (data1.message || []);

    console.log(`\n✅ Found ${quotes1.length} quotes\n`);

    // Find BANXA quote
    const banxaQuote1 = quotes1.find((q: any) => q.ramp?.toLowerCase() === 'banxa');

    if (banxaQuote1) {
      console.log('🔍 BANXA Quote (WITHOUT paymentMethod filter):');
      console.log(JSON.stringify({
        ramp: banxaQuote1.ramp,
        paymentMethod: banxaQuote1.paymentMethod,
        payout: banxaQuote1.payout,
        rate: banxaQuote1.rate,
        networkFee: banxaQuote1.networkFee,
        transactionFee: banxaQuote1.transactionFee,
        hasErrors: !!(banxaQuote1.errors && banxaQuote1.errors.length > 0),
        errors: banxaQuote1.errors,
        availablePaymentMethods: banxaQuote1.availablePaymentMethods?.map((pm: any) => ({
          paymentTypeId: pm.paymentTypeId || pm.id,
          name: pm.name
        })) || [],
        allKeys: Object.keys(banxaQuote1)
      }, null, 2));

      // Check if ideal is in availablePaymentMethods
      const hasIdeal = banxaQuote1.availablePaymentMethods?.some((pm: any) => {
        const id = (pm.paymentTypeId || pm.id || '').toLowerCase();
        return id.includes('ideal');
      });
      console.log(`\n✅ BANXA supports iDEAL: ${hasIdeal}`);
    } else {
      console.log('❌ BANXA quote not found');
    }

    // Test 2: WITH paymentMethod=ideal filter
    console.log('\n\n📊 Test 2: Fetching quotes WITH paymentMethod=ideal filter');
    const url2 = `${url1}&paymentMethod=ideal`;
    
    console.log(`URL: ${url2}`);

    const response2 = await fetch(url2, {
      method: 'GET',
      headers: {
        'Authorization': ONRAMPER_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    if (!response2.ok) {
      console.error(`❌ Error: ${response2.status} ${response2.statusText}`);
      const errorText = await response2.text();
      console.error(`Error body: ${errorText}`);
      return;
    }

    const data2 = await response2.json();
    const quotes2 = Array.isArray(data2) ? data2 : (data2.message || []);

    console.log(`\n✅ Found ${quotes2.length} quotes\n`);

    // Find BANXA quote
    const banxaQuote2 = quotes2.find((q: any) => q.ramp?.toLowerCase() === 'banxa');

    if (banxaQuote2) {
      console.log('🔍 BANXA Quote (WITH paymentMethod=ideal filter):');
      console.log(JSON.stringify({
        ramp: banxaQuote2.ramp,
        paymentMethod: banxaQuote2.paymentMethod,
        payout: banxaQuote2.payout,
        rate: banxaQuote2.rate,
        networkFee: banxaQuote2.networkFee,
        transactionFee: banxaQuote2.transactionFee,
        hasErrors: !!(banxaQuote2.errors && banxaQuote2.errors.length > 0),
        errors: banxaQuote2.errors,
        availablePaymentMethods: banxaQuote2.availablePaymentMethods?.map((pm: any) => ({
          paymentTypeId: pm.paymentTypeId || pm.id,
          name: pm.name
        })) || [],
        allKeys: Object.keys(banxaQuote2)
      }, null, 2));
    } else {
      console.log('❌ BANXA quote not found');
    }

    // Comparison
    console.log('\n\n📊 COMPARISON:');
    console.log('WITHOUT paymentMethod filter:');
    console.log(`  - Has payout: ${!!banxaQuote1?.payout}`);
    console.log(`  - Has rate: ${!!banxaQuote1?.rate}`);
    console.log(`  - Has errors: ${!!banxaQuote1?.errors?.length}`);
    console.log(`  - Supports iDEAL: ${banxaQuote1?.availablePaymentMethods?.some((pm: any) => (pm.paymentTypeId || pm.id || '').toLowerCase().includes('ideal')) || false}`);

    console.log('\nWITH paymentMethod=ideal filter:');
    console.log(`  - Has payout: ${!!banxaQuote2?.payout}`);
    console.log(`  - Has rate: ${!!banxaQuote2?.rate}`);
    console.log(`  - Has errors: ${!!banxaQuote2?.errors?.length}`);
    console.log(`  - Supports iDEAL: ${banxaQuote2?.availablePaymentMethods?.some((pm: any) => (pm.paymentTypeId || pm.id || '').toLowerCase().includes('ideal')) || false}`);

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

testBanxaWithoutPaymentMethod();

