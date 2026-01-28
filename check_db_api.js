const fs = require('fs');

// Load env vars
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SERVICE_KEY in .env.local');
  process.exit(1);
}

async function checkDatabase() {
  console.log('🔍 Checking live Supabase database...\n');

  // PART 1: Check address_book data
  console.log('=== PART 1: ADDRESS_BOOK USER_IDS ===');
  const addressBookRes = await fetch(`${SUPABASE_URL}/rest/v1/address_book?select=user_id`, {
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`
    }
  });
  const addressBook = await addressBookRes.json();
  
  const uuidCount = addressBook.filter(r => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(r.user_id)).length;
  const emailCount = addressBook.filter(r => r.user_id.includes('@')).length;
  const samples = [...new Set(addressBook.map(r => r.user_id.substring(0, 30)))];
  
  console.log(`Total rows: ${addressBook.length}`);
  console.log(`UUID format: ${uuidCount}`);
  console.log(`Email format: ${emailCount}`);
  console.log(`Sample user_ids:`, samples.slice(0, 5));
  console.log('');

  // PART 2: Check wallets data
  console.log('=== PART 2: WALLETS USER_IDS ===');
  const walletsRes = await fetch(`${SUPABASE_URL}/rest/v1/wallets?select=user_id`, {
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`
    }
  });
  const wallets = await walletsRes.json();
  
  const walletsUuid = wallets.filter(r => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(r.user_id)).length;
  const walletsEmail = wallets.filter(r => r.user_id && r.user_id.toString().includes('@')).length;
  
  console.log(`Total rows: ${wallets.length}`);
  console.log(`UUID format: ${walletsUuid}`);
  console.log(`Email format: ${walletsEmail}`);
  console.log('');

  // PART 3: Check Rick's data specifically
  console.log('=== PART 3: RICKS DATA ===');
  const ricksContactsRes = await fetch(`${SUPABASE_URL}/rest/v1/address_book?user_id=eq.ricks_@live.nl&select=*`, {
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`
    }
  });
  const ricksContacts = await ricksContactsRes.json();
  console.log(`Rick's contacts (email-based): ${ricksContacts.length}`);
  if (ricksContacts.length > 0) {
    console.log('Contact names:', ricksContacts.map(c => c.name));
  }
  
  console.log('\n✅ Done! Now checking RLS policies via SQL endpoint...');
}

checkDatabase().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
