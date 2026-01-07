/**
 * Test script to debug the verification logic
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const ONRAMPER_API_KEY = process.env.ONRAMPER_API_KEY?.trim().replace(/^["']|["']$/g, '');

if (!ONRAMPER_API_KEY) {
  console.error('❌ ONRAMPER_API_KEY not found');
  process.exit(1);
}

async function testVerification(crypto: string, chainName: string) {
  console.log(`\n🔍 Testing ${crypto} on ${chainName}...`);
  
  try {
    const url = `https://api.onramper.com/quotes/eur/${crypto.toLowerCase()}?amount=50`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': ONRAMPER_API_KEY,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.log(`❌ HTTP ${response.status}: ${response.statusText}`);
      return false;
    }

    const data = await response.json();
    
    console.log(`📊 Response type: ${Array.isArray(data) ? 'ARRAY' : typeof data}`);
    console.log(`📊 Response length: ${Array.isArray(data) ? data.length : 'N/A'}`);
    
    if (Array.isArray(data) && data.length > 0) {
      console.log(`\n📋 First quote structure:`);
      const firstQuote = data[0];
      console.log(JSON.stringify(firstQuote, null, 2).substring(0, 1000));
      
      // Check different ways to determine availability
      const hasPayout = firstQuote.payout !== undefined && firstQuote.payout !== null;
      const hasRate = firstQuote.rate !== undefined && firstQuote.rate !== null;
      const hasErrors = firstQuote.errors && firstQuote.errors.length > 0;
      const hasAvailableMethods = firstQuote.availablePaymentMethods && firstQuote.availablePaymentMethods.length > 0;
      const hasRamp = !!firstQuote.ramp;
      
      console.log(`\n🔍 Availability checks:`);
      console.log(`  - hasPayout: ${hasPayout} (${firstQuote.payout})`);
      console.log(`  - hasRate: ${hasRate} (${firstQuote.rate})`);
      console.log(`  - hasErrors: ${hasErrors}`);
      console.log(`  - hasAvailableMethods: ${hasAvailableMethods}`);
      console.log(`  - hasRamp: ${hasRamp} (${firstQuote.ramp})`);
      
      // Current logic
      const currentLogic = data.some((quote: any) => 
        quote.payout && parseFloat(quote.payout.toString()) > 0
      );
      console.log(`\n❌ Current logic result: ${currentLogic}`);
      
      // Better logic: check if we have any valid provider quotes
      const betterLogic = data.some((quote: any) => {
        // If it has a ramp/provider name, it's a valid quote (even without payout)
        // The payout might be missing but the provider is available
        return quote.ramp && (
          quote.payout > 0 || 
          quote.rate > 0 || 
          (quote.availablePaymentMethods && quote.availablePaymentMethods.length > 0)
        );
      });
      console.log(`✅ Better logic result: ${betterLogic}`);
      
      // Even better: just check if we have providers
      const simplestLogic = data.length > 0 && data.some((quote: any) => quote.ramp);
      console.log(`✅ Simplest logic result: ${simplestLogic}`);
      
      return simplestLogic;
    } else {
      console.log(`❌ No quotes returned`);
      return false;
    }
  } catch (error: any) {
    console.error(`❌ Error:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Testing verification logic for SOL on Solana...\n');
  
  const isAvailable = await testVerification('SOL', 'Solana');
  
  console.log(`\n📊 Final result: ${isAvailable ? '✅ AVAILABLE' : '❌ NOT AVAILABLE'}`);
}

main().catch(console.error);

