// Test using exact format from MCP server documentation

const fs = require('fs');
const envContent = fs.readFileSync('.env.local', 'utf8');
const envLines = envContent.split('\n');
let API_KEY = '';

for (const line of envLines) {
  if (line.startsWith('ONRAMPER_API_KEY=')) {
    const value = line.substring('ONRAMPER_API_KEY='.length);
    API_KEY = value.replace(/^["']|["']$/g, '').replace(/\\n/g, '').trim();
    break;
  }
}

async function testBuyQuotes() {
  console.log('🔍 Testing Onramper Buy Quotes API...');
  console.log('API Key:', API_KEY.substring(0, 10) + '...' + API_KEY.substring(API_KEY.length - 4));
  console.log('');
  
  // According to MCP docs: /quotes/{fiat}/{crypto} is for BUY
  // Parameters: amount, paymentMethod, country
  
  // Test 1: EUR -> SOL without payment method
  console.log('📊 Test 1: GET /quotes/eur/sol (BUY SOL with EUR)');
  const url1 = 'https://api.onramper.com/quotes/eur/sol?amount=100';
  console.log('URL:', url1);
  
  try {
    const response1 = await fetch(url1, {
      headers: {
        'Authorization': API_KEY,
        'Accept': 'application/json',
      }
    });
    
    console.log('Status:', response1.status, response1.statusText);
    
    if (response1.ok) {
      const data1 = await response1.json();
      console.log('Response type:', typeof data1);
      console.log('Is array:', Array.isArray(data1));
      
      if (Array.isArray(data1)) {
        console.log('Number of providers:', data1.length);
        console.log('');
        
        data1.forEach((q, i) => {
          console.log(`Provider ${i + 1}: ${q.ramp}`);
          console.log(`  Payment Method: ${q.paymentMethod || 'none'}`);
          console.log(`  Payout: ${q.payout || 'N/A'} SOL`);
          console.log(`  Rate: ${q.rate || 'N/A'}`);
          console.log(`  Has errors: ${!!(q.errors && q.errors.length > 0)}`);
          if (q.errors && q.errors.length > 0) {
            q.errors.forEach(err => console.log(`    Error: ${err.message}`));
          }
          if (q.availablePaymentMethods) {
            console.log(`  Available PMs: ${q.availablePaymentMethods.map(pm => pm.paymentTypeId).join(', ')}`);
          }
          console.log('');
        });
      }
    } else {
      const text = await response1.text();
      console.log('❌ Error response:', text);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  // Test 2: With creditcard payment method
  console.log('\n\n📊 Test 2: GET /quotes/eur/sol?paymentMethod=creditcard');
  const url2 = 'https://api.onramper.com/quotes/eur/sol?amount=100&paymentMethod=creditcard';
  console.log('URL:', url2);
  
  try {
    const response2 = await fetch(url2, {
      headers: {
        'Authorization': API_KEY,
        'Accept': 'application/json',
      }
    });
    
    console.log('Status:', response2.status, response2.statusText);
    
    if (response2.ok) {
      const data2 = await response2.json();
      
      if (Array.isArray(data2)) {
        console.log('Providers with creditcard:', data2.length);
        data2.forEach(q => {
          console.log(`  - ${q.ramp}: payout=${q.payout || 'N/A'} SOL, pm=${q.paymentMethod || 'none'}, errors=${q.errors?.length || 0}`);
        });
      }
    } else {
      console.log('❌ Error:', await response2.text());
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  // Test 3: With ideal payment method
  console.log('\n\n📊 Test 3: GET /quotes/eur/sol?paymentMethod=ideal');
  const url3 = 'https://api.onramper.com/quotes/eur/sol?amount=100&paymentMethod=ideal';
  console.log('URL:', url3);
  
  try {
    const response3 = await fetch(url3, {
      headers: {
        'Authorization': API_KEY,
        'Accept': 'application/json',
      }
    });
    
    console.log('Status:', response3.status, response3.statusText);
    
    if (response3.ok) {
      const data3 = await response3.json();
      
      if (Array.isArray(data3)) {
        console.log('Providers with ideal:', data3.length);
        data3.forEach(q => {
          console.log(`  - ${q.ramp}: payout=${q.payout || 'N/A'} SOL, pm=${q.paymentMethod || 'none'}, errors=${q.errors?.length || 0}`);
        });
      }
    } else {
      console.log('❌ Error:', await response3.text());
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testBuyQuotes();
