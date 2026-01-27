// Test without payment method to see what providers are actually available

async function testQuotes() {
  console.log('🔍 Testing quotes WITHOUT payment method filter...\n');
  
  const url = 'http://localhost:3000/api/onramper/quotes?fiatAmount=250&fiatCurrency=EUR&cryptoCurrency=SOL';
  console.log(`URL: ${url}\n`);
  
  const response = await fetch(url);
  const data = await response.json();
  
  console.log('Response status:', response.status);
  console.log('Success:', data.success);
  console.log('Number of quotes:', data.quotes?.length || 0);
  
  if (data.quotes && data.quotes.length > 0) {
    console.log('\n✅ Available providers:\n');
    data.quotes.forEach(q => {
      console.log(`  - ${q.ramp}:`);
      console.log(`    Payout: ${q.payout || 'N/A'} ${q.cryptoCurrency}`);
      console.log(`    Rate: ${q.rate || 'N/A'}`);
      console.log(`    Payment Method: ${q.paymentMethod || 'none'}`);
      console.log(`    Available Payment Methods: ${q.availablePaymentMethods?.map(pm => pm.paymentTypeId || pm.id).join(', ') || 'none'}`);
      console.log(`    Errors: ${q.errors?.length || 0}`);
      if (q.errors && q.errors.length > 0) {
        q.errors.forEach(err => console.log(`      - ${err}`));
      }
      console.log('');
    });
  } else {
    console.log('\n⚠️ No quotes available!');
    console.log('Full response:', JSON.stringify(data, null, 2));
  }
}

testQuotes();
