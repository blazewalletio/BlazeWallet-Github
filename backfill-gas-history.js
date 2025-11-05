#!/usr/bin/env node

// ============================================================================
// 🔥 BLAZE WALLET - BACKFILL 7-DAY HISTORICAL GAS DATA
// ============================================================================
// Populates gas_history table with last 7 days of data
// Run once to bootstrap the AI prediction system
// ============================================================================

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials!');
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Sample gas prices for 7 days (realistic patterns)
// Night (00:00-06:00): Lower gas prices
// Day (09:00-17:00): Higher gas prices
// Weekend: Slightly lower than weekday
const CHAIN_PATTERNS = {
  ethereum: {
    nightAvg: 15, // gwei
    dayAvg: 45,
    variation: 0.3, // ±30%
  },
  polygon: {
    nightAvg: 25,
    dayAvg: 80,
    variation: 0.4,
  },
  solana: {
    nightAvg: 5000, // microlamports
    dayAvg: 15000,
    variation: 0.5,
  },
  bitcoin: {
    nightAvg: 8, // sat/vB
    dayAvg: 25,
    variation: 0.4,
  },
};

async function generateHistoricalData() {
  console.log('🔄 Generating 7 days of historical gas data...\n');

  const chains = ['ethereum', 'polygon', 'solana', 'bitcoin'];
  const now = Date.now();
  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
  const INTERVAL = 15 * 60 * 1000; // 15 minutes

  let totalInserted = 0;

  for (const chain of chains) {
    console.log(`📊 Processing ${chain}...`);
    const pattern = CHAIN_PATTERNS[chain];
    const records = [];

    for (let time = now - SEVEN_DAYS; time < now; time += INTERVAL) {
      const date = new Date(time);
      const hour = date.getHours();
      const day = date.getDay();
      const isWeekend = day === 0 || day === 6;
      const isNight = hour >= 0 && hour < 6;

      // Calculate gas price based on time of day
      let baseGas = isNight ? pattern.nightAvg : pattern.dayAvg;
      
      // Weekend discount
      if (isWeekend) {
        baseGas *= 0.85;
      }

      // Add random variation
      const variation = 1 + (Math.random() - 0.5) * 2 * pattern.variation;
      const gasPrice = Math.max(1, baseGas * variation);

      records.push({
        chain,
        base_fee: gasPrice * 0.7,
        priority_fee: gasPrice * 0.3,
        gas_price: gasPrice,
        standard: gasPrice,
        fast: gasPrice * 1.2,
        instant: gasPrice * 1.5,
        source: 'backfill',
        created_at: date.toISOString(),
      });
    }

    // Insert in batches of 100
    for (let i = 0; i < records.length; i += 100) {
      const batch = records.slice(i, i + 100);
      const { error } = await supabase.from('gas_history').insert(batch);
      
      if (error) {
        console.error(`❌ Error inserting batch for ${chain}:`, error.message);
      } else {
        totalInserted += batch.length;
      }
    }

    console.log(`✅ ${chain}: ${records.length} records\n`);
  }

  console.log(`\n🎉 Successfully inserted ${totalInserted} historical records!`);
  console.log(`\n📊 Summary:`);
  console.log(`   - Time range: 7 days`);
  console.log(`   - Interval: 15 minutes`);
  console.log(`   - Chains: ${chains.join(', ')}`);
  console.log(`   - Total records: ${totalInserted}`);
  console.log(`\n✅ AI prediction system is now ready to use!`);
}

generateHistoricalData().catch(console.error);

