#!/usr/bin/env tsx
/**
 * 🔍 PAYMENT METHODS ANALYSIS
 * Check which providers support which payment methods
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const CLEAN_API_KEY = (process.env.ONRAMPER_API_KEY || '').trim().replace(/^["']|["']$/g, '').trim();

console.log('╔═══════════════════════════════════════════════════════════════╗');
console.log('║        PAYMENT METHODS ANALYSIS                              ║');
console.log('╚═══════════════════════════════════════════════════════════════╝\n');

async function analyzePaymentMethods() {
  // Get quotes without payment method filter to see all available methods
  const url = 'https://api.onramper.com/quotes/eur/eth?amount=100&country=NL';
  
  console.log('📊 Fetching quotes WITHOUT payment method filter...');
  console.log(`   URL: ${url}\n`);

  const response = await fetch(url, {
    headers: {
      'Authorization': CLEAN_API_KEY,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    console.log(`❌ FAILED: ${response.status} ${response.statusText}`);
    return;
  }

  const quotes = await response.json();
  
  if (!Array.isArray(quotes)) {
    console.log('❌ Unexpected response format');
    return;
  }

  console.log(`✅ Received ${quotes.length} provider quotes\n`);

  // Analyze each provider's available payment methods
  const providers: Record<string, {
    ramp: string;
    availablePaymentMethods: string[];
    hasIdeal: boolean;
    idealVariants: string[];
    errors?: any[];
  }> = {};

  quotes.forEach((quote: any) => {
    const ramp = quote.ramp || 'unknown';
    const paymentMethods = quote.availablePaymentMethods || [];
    const methodIds = paymentMethods.map((pm: any) => pm.paymentTypeId || pm.id || pm).filter(Boolean);
    
    const idealVariants = methodIds.filter((id: string) => 
      id.toLowerCase().includes('ideal')
    );

    providers[ramp] = {
      ramp,
      availablePaymentMethods: methodIds,
      hasIdeal: idealVariants.length > 0,
      idealVariants,
      errors: quote.errors,
    };
  });

  // Show providers that support iDeal | Wero
  console.log('🎯 PROVIDERS WITH iDeal | Wero SUPPORT:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const idealProviders = Object.values(providers).filter(p => p.hasIdeal && !p.errors);
  
  if (idealProviders.length === 0) {
    console.log('❌ No providers found with iDeal | Wero support!\n');
  } else {
    idealProviders.forEach((provider) => {
      console.log(`✅ ${provider.ramp.toUpperCase()}`);
      console.log(`   iDeal | Wero Variants: ${provider.idealVariants.join(', ')}`);
      console.log(`   All Payment Methods: ${provider.availablePaymentMethods.slice(0, 5).join(', ')}${provider.availablePaymentMethods.length > 5 ? '...' : ''}`);
      console.log('');
    });
  }

  // Show all providers and their payment methods
  console.log('\n📋 ALL PROVIDERS AND PAYMENT METHODS:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  Object.values(providers)
    .sort((a, b) => b.availablePaymentMethods.length - a.availablePaymentMethods.length)
    .forEach((provider) => {
      const icon = provider.hasIdeal ? '✅' : '❌';
      const errorIcon = provider.errors ? '⚠️' : '';
      console.log(`${icon} ${errorIcon} ${provider.ramp.toUpperCase()}`);
      if (provider.errors) {
        console.log(`   Errors: ${provider.errors.map((e: any) => e.message).join(', ')}`);
      } else {
        console.log(`   Payment Methods (${provider.availablePaymentMethods.length}): ${provider.availablePaymentMethods.slice(0, 8).join(', ')}${provider.availablePaymentMethods.length > 8 ? '...' : ''}`);
        if (provider.hasIdeal) {
          console.log(`   🎯 iDeal | Wero: ${provider.idealVariants.join(', ')}`);
        }
      }
      console.log('');
    });

  // Test different iDeal | Wero payment method IDs
  console.log('\n🧪 TESTING DIFFERENT iDeal | Wero PAYMENT METHOD IDs:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const idealVariants = ['ideal', 'idealbanktransfer', 'idealbank', 'idealnl'];
  
  for (const variant of idealVariants) {
    const testUrl = `https://api.onramper.com/quotes/eur/eth?amount=100&paymentMethod=${variant}&country=NL`;
    console.log(`Testing: paymentMethod=${variant}`);
    
    try {
      const testResponse = await fetch(testUrl, {
        headers: {
          'Authorization': CLEAN_API_KEY,
          'Accept': 'application/json',
        },
      });

      if (testResponse.ok) {
        const testQuotes = await testResponse.json();
        const validQuotes = Array.isArray(testQuotes) ? testQuotes.filter((q: any) => !q.errors || q.errors.length === 0) : [];
        const providers = validQuotes.map((q: any) => q.ramp).join(', ');
        
        console.log(`   ✅ ${validQuotes.length} valid quotes from: ${providers || 'none'}`);
      } else {
        console.log(`   ❌ ${testResponse.status} ${testResponse.statusText}`);
      }
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
    }
    console.log('');
  }
}

async function runAnalysis() {
  await analyzePaymentMethods();
  
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║                    ANALYSIS COMPLETE                         ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
}

runAnalysis().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});

