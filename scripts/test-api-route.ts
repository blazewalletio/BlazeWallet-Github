/**
 * Test the actual API route to see what's happening
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function testApiRoute(chainId: number) {
  console.log(`\n🔍 Testing API route for chainId ${chainId}...`);
  
  // Test local API route
  const url = `http://localhost:3000/api/onramper/available-cryptos?chainId=${chainId}`;
  
  try {
    console.log(`📡 Calling: ${url}`);
    const response = await fetch(url);
    const data = await response.json();
    
    console.log(`\n📊 Response:`);
    console.log(JSON.stringify(data, null, 2));
    
    if (data.success && data.cryptos) {
      console.log(`\n✅ Available cryptos: ${data.cryptos.length > 0 ? data.cryptos.join(', ') : 'None'}`);
    } else {
      console.log(`\n❌ Error: ${data.error || 'Unknown error'}`);
    }
  } catch (error: any) {
    console.error(`❌ Error calling API:`, error.message);
    console.log(`\n💡 Make sure the dev server is running: npm run dev`);
  }
}

async function main() {
  console.log('🚀 Testing available-cryptos API route...\n');
  
  // Test Solana (chainId 101)
  await testApiRoute(101);
  
  // Test Ethereum (chainId 1)
  await testApiRoute(1);
}

main().catch(console.error);

