/**
 * Check ALL wallet addresses for ricks_@live.nl user
 * Including any that might be stored in different places
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const email = 'ricks_@live.nl';

async function checkAllWalletAddresses() {
  console.log('🔍 Checking ALL wallet addresses for:', email);
  console.log('========================================\n');

  try {
    // 1. Get user
    const { data: users } = await supabase.auth.admin.listUsers();
    const user = users.users.find(u => u.email && u.email.toLowerCase() === email.toLowerCase());
    
    if (!user) {
      console.log('❌ User not found!');
      return;
    }

    console.log(`User ID: ${user.id}`);
    console.log(`Email: ${user.email}\n`);

    // 2. Check wallets table
    console.log('1️⃣ WALLETS TABLE:');
    console.log('----------------------------------------');
    const { data: wallets, error: walletsError } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (walletsError) {
      console.error('Error:', walletsError);
    } else {
      console.log(`Found ${wallets.length} wallet(s) in wallets table:`);
      wallets.forEach((w, idx) => {
        console.log(`  ${idx + 1}. Wallet ID: ${w.id}`);
        console.log(`     Address: ${w.wallet_address || 'NULL'}`);
        console.log(`     Created: ${w.created_at}`);
        console.log(`     Updated: ${w.updated_at}`);
        console.log('');
      });
    }

    // 3. Check if there are ANY wallets with addresses that match this user's wallet addresses
    if (wallets && wallets.length > 0) {
      const addresses = wallets.filter(w => w.wallet_address).map(w => w.wallet_address);
      
      console.log('2️⃣ CHECKING FOR DUPLICATE ADDRESSES IN ENTIRE DATABASE:');
      console.log('----------------------------------------');
      
      for (const addr of addresses) {
        const { data: allWalletsWithAddr, error: addrError } = await supabase
          .from('wallets')
          .select('id, user_id, wallet_address, created_at')
          .eq('wallet_address', addr);
        
        if (!addrError && allWalletsWithAddr) {
          if (allWalletsWithAddr.length > 1) {
            console.log(`\n⚠️  Address ${addr} appears ${allWalletsWithAddr.length} times:`);
            for (const w of allWalletsWithAddr) {
              const { data: userData } = await supabase.auth.admin.getUserById(w.user_id);
              const userEmail = userData?.user?.email || 'Unknown';
              console.log(`  - Wallet ${w.id} (User: ${w.user_id} - ${userEmail}, Created: ${w.created_at})`);
            }
          } else {
            console.log(`✅ Address ${addr} appears only once (normal)`);
          }
        }
      }
    }

    // 4. Check ALL wallets for this user_id (in case there are any we missed)
    console.log('\n3️⃣ ALL WALLETS FOR USER_ID (direct query):');
    console.log('----------------------------------------');
    const { data: allWalletsForUser, error: allErr } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', user.id);
    
    if (!allErr) {
      console.log(`Found ${allWalletsForUser.length} wallet(s):`);
      if (allWalletsForUser.length > 1) {
        console.log('\n🚨 PROBLEM: Multiple wallets for same user_id!');
        console.log('This violates UNIQUE(user_id) constraint!\n');
        allWalletsForUser.forEach((w, idx) => {
          console.log(`Wallet ${idx + 1}:`);
          console.log(`  ID: ${w.id}`);
          console.log(`  Address: ${w.wallet_address || 'NULL'}`);
          console.log(`  Created: ${w.created_at}`);
          console.log('');
        });
      }
    }

    // 5. Check transaction history - see if there are transactions from different addresses
    console.log('4️⃣ CHECKING TRANSACTION HISTORY FOR MULTIPLE ADDRESSES:');
    console.log('----------------------------------------');
    // This would require checking a transactions table if it exists
    // For now, just note that we should check this

    // 6. Summary
    console.log('\n========================================');
    console.log('📊 SUMMARY');
    console.log('========================================\n');
    
    if (wallets && wallets.length > 1) {
      console.log('🚨 ISSUE FOUND:');
      console.log(`  - User has ${wallets.length} wallets (should be 1)`);
      console.log(`  - Wallet addresses:`);
      wallets.forEach((w, idx) => {
        console.log(`    ${idx + 1}. ${w.wallet_address || 'NULL'} (Created: ${w.created_at})`);
      });
      console.log('\n💡 RECOMMENDATION:');
      console.log('  Keep the oldest wallet, delete the rest.');
      console.log('  Run FIX_DUPLICATE_EMAIL_ACCOUNTS.sql to fix this.');
    } else if (wallets && wallets.length === 1) {
      console.log('✅ Only 1 wallet found (this is normal)');
      console.log(`  Wallet Address: ${wallets[0].wallet_address || 'NULL'}`);
    } else {
      console.log('⚠️  No wallets found for this user!');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkAllWalletAddresses();

