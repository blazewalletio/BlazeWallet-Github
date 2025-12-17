/**
 * Trigger Token Sync Job
 * 
 * This script triggers the token sync job via the API route
 * Run with: npx tsx scripts/trigger-sync.ts
 */

// Load environment variables
import { config } from 'dotenv';
import { resolve } from 'path';

const envPath = resolve(process.cwd(), '.env.local');
const envPathFallback = resolve(process.cwd(), '.env');
config({ path: envPath });
config({ path: envPathFallback, override: false });

const syncUrl = process.env.NEXT_PUBLIC_APP_URL 
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/tokens/sync`
  : 'http://localhost:3000/api/tokens/sync';

const cronSecret = process.env.CRON_SECRET || 'dev-secret-change-in-production';

async function triggerSync() {
  console.log('🚀 Triggering token sync job...');
  console.log(`📍 URL: ${syncUrl}`);
  
  try {
    const response = await fetch(syncUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': cronSecret,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Sync failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    
    console.log('\n✅ Sync job triggered successfully!');
    console.log('\n📊 Results:');
    console.log(`   Total synced: ${result.totalSynced?.toLocaleString() || 0} tokens`);
    
    if (result.results) {
      console.log('\n   Per chain:');
      Object.entries(result.results).forEach(([chain, count]: [string, any]) => {
        console.log(`     ${chain.padEnd(15)} ${count.toLocaleString().padStart(10)} tokens`);
      });
    }
    
    if (result.errors) {
      console.log('\n⚠️ Errors:');
      Object.entries(result.errors).forEach(([chain, error]) => {
        console.log(`     ${chain}: ${error}`);
      });
    }
    
    console.log('\n✅ Done!');
  } catch (error: any) {
    console.error('❌ Failed to trigger sync:', error.message);
    console.error('\n💡 Tip: Make sure your Next.js server is running (npm run dev)');
    process.exit(1);
  }
}

triggerSync();

