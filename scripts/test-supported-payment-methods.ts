#!/usr/bin/env tsx
/**
 * 🔍 CHECK ONRAMPER SUPPORTED PAYMENT METHODS
 * See what Onramper claims to support vs what providers actually offer
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const CLEAN_API_KEY = (process.env.ONRAMPER_API_KEY || '').trim().replace(/^["']|["']$/g, '').trim();

console.log('╔═══════════════════════════════════════════════════════════════╗');
console.log('║   ONRAMPER SUPPORTED PAYMENT METHODS CHECK                    ║');
console.log('╚═══════════════════════════════════════════════════════════════╝\n');

async function checkSupportedPaymentMethods() {
  // Check what Onramper says is supported
  console.log('📊 Fetching /supported/payment-types...\n');
  
  const supportedUrl = 'https://api.onramper.com/supported/payment-types?type=buy&country=NL';
  const response = await fetch(supportedUrl, {
    headers: {
      'Authorization': CLEAN_API_KEY,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    console.log(`❌ FAILED: ${response.status} ${response.statusText}`);
    return;
  }

  const data = await response.json();
  const paymentTypes = data.message || data || [];

  console.log(`✅ Found ${Array.isArray(paymentTypes) ? paymentTypes.length : 'unknown'} payment types\n`);

  // Look for iDEAL
  const idealMethods = Array.isArray(paymentTypes) 
    ? paymentTypes.filter((pm: any) => {
        const id = pm.id || pm.paymentTypeId || pm.code || '';
        const name = pm.name || pm.displayName || '';
        return id.toLowerCase().includes('ideal') || name.toLowerCase().includes('ideal');
      })
    : [];

  console.log('🎯 iDEAL PAYMENT METHODS IN SUPPORTED LIST:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (idealMethods.length === 0) {
    console.log('❌ No iDEAL payment methods found in supported list!\n');
  } else {
    idealMethods.forEach((pm: any) => {
      console.log(`✅ ${pm.id || pm.paymentTypeId || 'unknown'}`);
      console.log(`   Name: ${pm.name || pm.displayName || 'N/A'}`);
      console.log(`   Code: ${pm.code || 'N/A'}`);
      console.log('');
    });
  }

  // Show all payment methods
  console.log('\n📋 ALL SUPPORTED PAYMENT METHODS (first 20):');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (Array.isArray(paymentTypes)) {
    paymentTypes.slice(0, 20).forEach((pm: any) => {
      const id = pm.id || pm.paymentTypeId || pm.code || 'unknown';
      const name = pm.name || pm.displayName || id;
      console.log(`   • ${id} - ${name}`);
    });
    if (paymentTypes.length > 20) {
      console.log(`   ... and ${paymentTypes.length - 20} more`);
    }
  }

  // Now check which providers actually support iDEAL
  console.log('\n\n🔍 CHECKING WHICH PROVIDERS ACTUALLY SUPPORT iDEAL:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const quotesUrl = 'https://api.onramper.com/quotes/eur/eth?amount=100&country=NL';
  const quotesResponse = await fetch(quotesUrl, {
    headers: {
      'Authorization': CLEAN_API_KEY,
      'Accept': 'application/json',
    },
  });

  if (quotesResponse.ok) {
    const quotes = await quotesResponse.json();
    
    if (Array.isArray(quotes)) {
      const providersWithIdeal = quotes
        .filter((q: any) => {
          const methods = q.availablePaymentMethods || [];
          return methods.some((pm: any) => {
            const id = pm.paymentTypeId || pm.id || '';
            return id.toLowerCase().includes('ideal');
          });
        })
        .map((q: any) => ({
          ramp: q.ramp,
          methods: (q.availablePaymentMethods || []).map((pm: any) => pm.paymentTypeId || pm.id).filter(Boolean),
        }));

      console.log(`✅ Providers that actually support iDEAL: ${providersWithIdeal.length}\n`);
      
      providersWithIdeal.forEach((provider) => {
        console.log(`   • ${provider.ramp.toUpperCase()}`);
        console.log(`     Payment Methods: ${provider.methods.join(', ')}`);
        console.log('');
      });

      if (providersWithIdeal.length === 0) {
        console.log('   ❌ No providers actually support iDEAL in their availablePaymentMethods!\n');
      }
    }
  }
}

checkSupportedPaymentMethods().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});

