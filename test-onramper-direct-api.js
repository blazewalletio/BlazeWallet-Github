// Test Onramper API directly to see what's happening

// Load .env.local
const fs = require('fs');
const envContent = fs.readFileSync('.env.local', 'utf8');
const envLines = envContent.split('\n');
let API_KEY = '';

for (const line of envLines) {
  if (line.startsWith('ONRAMPER_API_KEY=')) {
    // Extract the value and clean it properly
    const value = line.substring('ONRAMPER_API_KEY='.length);
    // Remove surrounding quotes and backslash-n
    API_KEY = value.replace(/^["']|["']$/g, '').replace(/\\n/g, '').trim();
    break;
  }
}

async function testOnramperDirect() {
  console.log('🔍 Testing Onramper API directly...');
  console.log('API Key length:', API_KEY.length);
  console.log('API Key prefix:', API_KEY.substring(0, 15));
  console.log('');
  
  // Test 1: Get quotes EUR->SOL without payment method
  console.log('📊 Test 1: GET /quotes/eur/sol (no payment method)');
  const url1 = 'https://api.onramper.com/quotes/eur/sol?amount=250';
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
      console.log('Response is array:', Array.isArray(data1));
      console.log('Number of quotes:', Array.isArray(data1) ? data1.length : 'N/A');
      
      if (Array.isArray(data1) && data1.length > 0) {
        console.log('\n✅ Providers:');
        data1.forEach(q => {
          console.log(`  - ${q.ramp}:`);
          console.log(`    Payment Method: ${q.paymentMethod || 'none'}`);
          console.log(`    Payout: ${q.payout || 'N/A'} SOL`);
          console.log(`    Has errors: ${!!(q.errors && q.errors.length > 0)}`);
          if (q.errors && q.errors.length > 0) {
            q.errors.forEach(err => console.log(`      - ${err.message}`));
          }
        });
      }
    } else {
      console.log('❌ Error:', await response1.text());
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  // Test 2: With payment method
  console.log('\n\n📊 Test 2: GET /quotes/eur/sol WITH paymentMethod=creditcard');
  const url2 = 'https://api.onramper.com/quotes/eur/sol?amount=250&paymentMethod=creditcard';
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
      console.log('Response is array:', Array.isArray(data2));
      console.log('Number of quotes:', Array.isArray(data2) ? data2.length : 'N/A');
      
      if (Array.isArray(data2) && data2.length > 0) {
        console.log('\n✅ Providers for creditcard:');
        data2.forEach(q => {
          console.log(`  - ${q.ramp}: payout=${q.payout || 'N/A'}, pm=${q.paymentMethod || 'none'}`);
        });
      }
    } else {
      console.log('❌ Error:', await response2.text());
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testOnramperDirect();
