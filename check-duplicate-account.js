/**
 * Direct Supabase Check for Duplicate Account
 * Uses service role key to check what happened with ricks_@live.nl
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const email = 'ricks_@live.nl';

async function checkDuplicateAccount() {
  console.log('🔍 Checking duplicate account situation for:', email);
  console.log('========================================\n');

  try {
    // 1. Check auth.users
    console.log('1️⃣ AUTH.USERS:');
    console.log('----------------------------------------');
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError) {
      console.error('❌ Error fetching users:', usersError);
      return;
    }

    const matchingUsers = users.users.filter(u => 
      u.email && u.email.toLowerCase() === email.toLowerCase()
    );

    console.log(`Found ${matchingUsers.length} user(s) with email ${email}:`);
    matchingUsers.forEach((user, idx) => {
      console.log(`\n  User ${idx + 1}:`);
      console.log(`    ID: ${user.id}`);
      console.log(`    Email: ${user.email}`);
      console.log(`    Created: ${user.created_at}`);
      console.log(`    Last Sign In: ${user.last_sign_in_at || 'Never'}`);
      console.log(`    Email Confirmed: ${user.email_confirmed_at ? 'Yes' : 'No'}`);
    });

    if (matchingUsers.length === 0) {
      console.log('  ⚠️  No users found with this email!');
      return;
    }

    const userIds = matchingUsers.map(u => u.id);
    const oldestUser = matchingUsers.sort((a, b) => 
      new Date(a.created_at) - new Date(b.created_at)
    )[0];
    const newestUser = matchingUsers.sort((a, b) => 
      new Date(b.created_at) - new Date(a.created_at)
    )[0];

    console.log(`\n  📊 Summary:`);
    console.log(`    Oldest user_id: ${oldestUser.id} (created: ${oldestUser.created_at})`);
    if (oldestUser.id !== newestUser.id) {
      console.log(`    Newest user_id: ${newestUser.id} (created: ${newestUser.created_at})`);
      console.log(`    ⚠️  DUPLICATE USERS DETECTED!`);
    }

    // 2. Check wallets - THIS IS THE KEY CHECK!
    console.log('\n2️⃣ WALLETS:');
    console.log('----------------------------------------');
    const { data: wallets, error: walletsError } = await supabase
      .from('wallets')
      .select('*')
      .in('user_id', userIds)
      .order('created_at', { ascending: true });

    if (walletsError) {
      console.error('❌ Error fetching wallets:', walletsError);
    } else {
      console.log(`Found ${wallets.length} wallet(s) for user(s) with email ${email}:`);
      
      if (wallets.length === 0) {
        console.log('  ⚠️  No wallets found!');
      } else if (wallets.length === 1) {
        console.log('  ✅ Only 1 wallet found (this is normal)');
      } else {
        console.log(`  ⚠️  PROBLEM: Found ${wallets.length} wallets for the same user!`);
        console.log('  This means multiple wallets were created, possibly from duplicate signup attempts.');
      }
      
      wallets.forEach((wallet, idx) => {
        console.log(`\n  Wallet ${idx + 1}:`);
        console.log(`    ID: ${wallet.id}`);
        console.log(`    User ID: ${wallet.user_id}`);
        console.log(`    Wallet Address: ${wallet.wallet_address || 'NULL'}`);
        console.log(`    Created: ${wallet.created_at}`);
        console.log(`    Updated: ${wallet.updated_at}`);
        
        // Check if this wallet address is unique
        if (wallet.wallet_address) {
          const otherWalletsWithSameAddress = wallets.filter(w => 
            w.wallet_address === wallet.wallet_address && w.id !== wallet.id
          );
          if (otherWalletsWithSameAddress.length > 0) {
            console.log(`    ⚠️  DUPLICATE ADDRESS: This address also exists in wallet(s): ${otherWalletsWithSameAddress.map(w => w.id).join(', ')}`);
          }
        }
      });
      
      // Group by user_id to see if one user has multiple wallets
      const walletsByUserId = {};
      wallets.forEach(w => {
        if (!walletsByUserId[w.user_id]) {
          walletsByUserId[w.user_id] = [];
        }
        walletsByUserId[w.user_id].push(w);
      });
      
      Object.keys(walletsByUserId).forEach(userId => {
        if (walletsByUserId[userId].length > 1) {
          console.log(`\n  🚨 CRITICAL: User ${userId} has ${walletsByUserId[userId].length} wallets!`);
          console.log('  This violates the UNIQUE(user_id) constraint and will cause errors!');
          console.log('  Wallets:');
          walletsByUserId[userId].forEach((w, idx) => {
            console.log(`    ${idx + 1}. Wallet ${w.id} - Address: ${w.wallet_address || 'NULL'} - Created: ${w.created_at}`);
          });
        }
      });

      // Check for multiple wallets per user
      const walletsByUser = {};
      wallets.forEach(w => {
        if (!walletsByUser[w.user_id]) {
          walletsByUser[w.user_id] = [];
        }
        walletsByUser[w.user_id].push(w);
      });

      Object.keys(walletsByUser).forEach(userId => {
        if (walletsByUser[userId].length > 1) {
          console.log(`\n  ⚠️  User ${userId} has ${walletsByUser[userId].length} wallets!`);
          walletsByUser[userId].forEach((w, idx) => {
            console.log(`    Wallet ${idx + 1}: ${w.id} (${w.wallet_address || 'NULL'})`);
          });
        }
      });
      
      // Store for later use
      global.walletsByUser = walletsByUser;

      // Check for duplicate addresses
      const addresses = wallets.filter(w => w.wallet_address).map(w => w.wallet_address);
      const duplicateAddresses = addresses.filter((addr, idx) => addresses.indexOf(addr) !== idx);
      if (duplicateAddresses.length > 0) {
        console.log(`\n  ⚠️  DUPLICATE WALLET ADDRESSES DETECTED!`);
        [...new Set(duplicateAddresses)].forEach(addr => {
          const walletsWithAddr = wallets.filter(w => w.wallet_address === addr);
          console.log(`    Address ${addr} appears ${walletsWithAddr.length} times:`);
          walletsWithAddr.forEach(w => {
            console.log(`      - Wallet ${w.id} (User: ${w.user_id})`);
          });
        });
      }
    }

    // 3. Check trusted devices
    console.log('\n3️⃣ TRUSTED DEVICES:');
    console.log('----------------------------------------');
    const { data: devices, error: devicesError } = await supabase
      .from('trusted_devices')
      .select('*')
      .in('user_id', userIds)
      .order('last_used_at', { ascending: false, nullsLast: true });

    if (devicesError) {
      console.error('❌ Error fetching devices:', devicesError);
    } else {
      console.log(`Found ${devices.length} device(s):`);
      devices.forEach((device, idx) => {
        console.log(`\n  Device ${idx + 1}:`);
        console.log(`    ID: ${device.id}`);
        console.log(`    User ID: ${device.user_id}`);
        console.log(`    Device Name: ${device.device_name}`);
        console.log(`    Verified: ${device.verified_at ? 'Yes' : 'No'}`);
        console.log(`    Is Current: ${device.is_current ? 'Yes' : 'No'}`);
        console.log(`    Last Used: ${device.last_used_at || 'Never'}`);
      });
    }

    // 4. Check user profiles
    console.log('\n4️⃣ USER PROFILES:');
    console.log('----------------------------------------');
    const { data: profiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('*')
      .in('user_id', userIds);

    if (profilesError) {
      console.error('❌ Error fetching profiles:', profilesError);
    } else {
      console.log(`Found ${profiles.length} profile(s):`);
      profiles.forEach((profile, idx) => {
        console.log(`\n  Profile ${idx + 1}:`);
        console.log(`    ID: ${profile.id}`);
        console.log(`    User ID: ${profile.user_id}`);
        console.log(`    Display Name: ${profile.display_name || 'N/A'}`);
        console.log(`    Created: ${profile.created_at}`);
      });
    }

    // 5. Check security scores
    console.log('\n5️⃣ SECURITY SCORES:');
    console.log('----------------------------------------');
    const { data: scores, error: scoresError } = await supabase
      .from('user_security_scores')
      .select('*')
      .in('user_id', userIds);

    if (scoresError) {
      console.error('❌ Error fetching scores:', scoresError);
    } else {
      console.log(`Found ${scores.length} security score(s):`);
      scores.forEach((score, idx) => {
        console.log(`\n  Score ${idx + 1}:`);
        console.log(`    User ID: ${score.user_id}`);
        console.log(`    Score: ${score.score}/100`);
        console.log(`    Email Verified: ${score.email_verified ? 'Yes' : 'No'}`);
        console.log(`    2FA Enabled: ${score.two_factor_enabled ? 'Yes' : 'No'}`);
      });
    }

    // 6. Summary and recommendations
    // 7. Check for orphaned wallets (wallets without valid user)
    console.log('\n7️⃣ CHECKING FOR ORPHANED WALLETS:');
    console.log('----------------------------------------');
    const { data: allWalletsCheck, error: allWalletsCheckErr } = await supabase
      .from('wallets')
      .select('id, user_id, wallet_address');
    
    if (!allWalletsCheckErr && allWalletsCheck) {
      const allUserIds = new Set(users.users.map(u => u.id));
      const orphanedWallets = allWalletsCheck.filter(w => !allUserIds.has(w.user_id));
      
      if (orphanedWallets.length > 0) {
        console.log(`⚠️  Found ${orphanedWallets.length} orphaned wallet(s):`);
        orphanedWallets.forEach(w => {
          console.log(`    - Wallet ${w.id} (User ID: ${w.user_id} - User does not exist)`);
        });
      } else {
        console.log('✅ No orphaned wallets found');
      }
    }

    // 8. Check wallet creation history for this email
    console.log('\n8️⃣ WALLET CREATION HISTORY:');
    console.log('----------------------------------------');
    if (wallets && wallets.length > 0) {
      console.log(`Wallet created: ${wallets[0].created_at}`);
      console.log(`User created: ${oldestUser.created_at}`);
      const timeDiff = new Date(wallets[0].created_at) - new Date(oldestUser.created_at);
      console.log(`Time difference: ${Math.round(timeDiff / 1000)} seconds`);
      
      // Check if there are any deleted wallets in the sync logs
      const { data: syncLogs, error: syncLogsErr } = await supabase
        .from('wallet_sync_logs')
        .select('*')
        .in('user_id', userIds)
        .order('synced_at', { ascending: false })
        .limit(10);
      
      if (!syncLogsErr && syncLogs && syncLogs.length > 0) {
        console.log(`\nRecent sync logs (last 10):`);
        syncLogs.forEach(log => {
          console.log(`  - ${log.sync_type} at ${log.synced_at} (Success: ${log.success})`);
        });
      }
    }

    // 9. Check for any constraint violations
    console.log('\n9️⃣ CHECKING FOR CONSTRAINT VIOLATIONS:');
    console.log('----------------------------------------');
    
    // Check UNIQUE constraint on wallet_address
    if (wallets && wallets.length > 0 && wallets[0].wallet_address) {
      const { data: addressCheck, error: addressCheckErr } = await supabase
        .from('wallets')
        .select('wallet_address')
        .eq('wallet_address', wallets[0].wallet_address);
      
      if (!addressCheckErr && addressCheck && addressCheck.length > 1) {
        console.log(`⚠️  UNIQUE constraint violation: wallet_address ${wallets[0].wallet_address} appears ${addressCheck.length} times`);
      } else {
        console.log('✅ No UNIQUE constraint violations on wallet_address');
      }
    }
    
    // Check UNIQUE constraint on user_id - THIS IS CRITICAL!
    const { data: userIdCheck, error: userIdCheckErr } = await supabase
      .from('wallets')
      .select('user_id, id, wallet_address, created_at')
      .in('user_id', userIds);
    
    if (!userIdCheckErr && userIdCheck) {
      const userIdCounts = {};
      userIdCheck.forEach(w => {
        if (!userIdCounts[w.user_id]) {
          userIdCounts[w.user_id] = [];
        }
        userIdCounts[w.user_id].push(w);
      });
      
      const violations = Object.entries(userIdCounts).filter(([id, wallets]) => wallets.length > 1);
      if (violations.length > 0) {
        console.log(`\n🚨 CRITICAL: UNIQUE constraint violation detected!`);
        violations.forEach(([userId, walletList]) => {
          console.log(`\n  User ${userId} has ${walletList.length} wallets (should be max 1):`);
          walletList.forEach((w, idx) => {
            console.log(`    ${idx + 1}. Wallet ${w.id}`);
            console.log(`       Address: ${w.wallet_address || 'NULL'}`);
            console.log(`       Created: ${w.created_at}`);
          });
        });
      } else {
        console.log('✅ No UNIQUE constraint violations on user_id');
      }
    }
    
    // 10. Check ALL wallets in database to see if there are any with this user_id that we missed
    console.log('\n🔟 DEEP CHECK: All wallets for this user_id (including any edge cases):');
    console.log('----------------------------------------');
    const { data: allWalletsForUser, error: allWalletsForUserErr } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', oldestUser.id);
    
    if (!allWalletsForUserErr) {
      console.log(`Found ${allWalletsForUser.length} wallet(s) directly linked to user_id ${oldestUser.id}:`);
      if (allWalletsForUser.length > 1) {
        console.log('\n  🚨 PROBLEM: Multiple wallets found for same user_id!');
        allWalletsForUser.forEach((w, idx) => {
          console.log(`\n  Wallet ${idx + 1}:`);
          console.log(`    ID: ${w.id}`);
          console.log(`    Address: ${w.wallet_address || 'NULL'}`);
          console.log(`    Created: ${w.created_at}`);
          console.log(`    Updated: ${w.updated_at}`);
        });
      } else if (allWalletsForUser.length === 1) {
        console.log('  ✅ Only 1 wallet found (normal)');
      } else {
        console.log('  ⚠️  No wallets found for this user!');
      }
    }
    
    // 11. Check wallet_sync_logs to see if there were multiple wallet creation attempts
    console.log('\n1️⃣1️⃣ WALLET SYNC LOGS (to see creation history):');
    console.log('----------------------------------------');
    const { data: syncLogs, error: syncLogsErr } = await supabase
      .from('wallet_sync_logs')
      .select('*')
      .in('user_id', userIds)
      .order('synced_at', { ascending: false })
      .limit(20);
    
    if (!syncLogsErr && syncLogs) {
      console.log(`Found ${syncLogs.length} sync log entry/entries:`);
      if (syncLogs.length > 0) {
        syncLogs.forEach((log, idx) => {
          console.log(`\n  Log ${idx + 1}:`);
          console.log(`    Type: ${log.sync_type}`);
          console.log(`    Wallet ID: ${log.wallet_id || 'N/A'}`);
          console.log(`    Success: ${log.success}`);
          console.log(`    Error: ${log.error_message || 'None'}`);
          console.log(`    Synced At: ${log.synced_at}`);
        });
      } else {
        console.log('  No sync logs found');
      }
    }

    console.log('\n========================================');
    console.log('📊 SUMMARY & RECOMMENDATIONS');
    console.log('========================================\n');

    const issues = [];
    
    if (matchingUsers.length > 1) {
      issues.push(`⚠️  ${matchingUsers.length} users with same email`);
    }
    
    if (wallets && wallets.length > 0) {
      const walletsByUser = {};
      wallets.forEach(w => {
        if (!walletsByUser[w.user_id]) {
          walletsByUser[w.user_id] = [];
        }
        walletsByUser[w.user_id].push(w);
      });
      
      const multipleWallets = Object.values(walletsByUser).some(w => w.length > 1);
      if (multipleWallets) {
        issues.push('⚠️  Multiple wallets per user_id');
      }
      
      const duplicateAddrs = wallets.filter(w => w.wallet_address).map(w => w.wallet_address);
      const uniqueAddrs = [...new Set(duplicateAddrs)];
      if (duplicateAddrs.length !== uniqueAddrs.length) {
        issues.push('⚠️  Duplicate wallet addresses');
      }
      
      // Check for duplicate addresses across ALL wallets (not just this user)
      if (wallets[0] && wallets[0].wallet_address) {
        const { data: allWalletsWithAddress, error: allWalletsError } = await supabase
          .from('wallets')
          .select('id, user_id, wallet_address, created_at')
          .eq('wallet_address', wallets[0].wallet_address)
          .not('wallet_address', 'is', null);
        
        if (!allWalletsError && allWalletsWithAddress && allWalletsWithAddress.length > 1) {
          console.log(`\n  ⚠️  WALLET ADDRESS ${wallets[0].wallet_address} EXISTS IN MULTIPLE WALLETS:`);
          for (const w of allWalletsWithAddress) {
            const { data: userData } = await supabase.auth.admin.getUserById(w.user_id);
            const userEmail = userData?.user?.email || 'Unknown';
            console.log(`    - Wallet ${w.id} (User: ${w.user_id} - ${userEmail}, Created: ${w.created_at})`);
          }
          issues.push(`⚠️  Wallet address ${wallets[0].wallet_address} exists in ${allWalletsWithAddress.length} wallets`);
        }
      }
      
      // Also check ALL duplicate addresses in the entire database
      console.log('\n6️⃣ CHECKING ALL DUPLICATE WALLET ADDRESSES IN DATABASE:');
      console.log('----------------------------------------');
      const { data: allWallets, error: allWalletsErr } = await supabase
        .from('wallets')
        .select('id, user_id, wallet_address, created_at')
        .not('wallet_address', 'is', null)
        .order('wallet_address', { ascending: true });
      
      if (!allWalletsErr && allWallets) {
        const addressMap = {};
        allWallets.forEach(w => {
          if (!addressMap[w.wallet_address]) {
            addressMap[w.wallet_address] = [];
          }
          addressMap[w.wallet_address].push(w);
        });
        
        const duplicates = Object.entries(addressMap).filter(([addr, wallets]) => wallets.length > 1);
        
        if (duplicates.length > 0) {
          console.log(`Found ${duplicates.length} duplicate wallet address(es):\n`);
          for (const [address, walletList] of duplicates) {
            console.log(`  Address: ${address} (appears ${walletList.length} times)`);
            for (const w of walletList) {
              const { data: userData } = await supabase.auth.admin.getUserById(w.user_id);
              const userEmail = userData?.user?.email || 'Unknown';
              console.log(`    - Wallet ${w.id} (User: ${w.user_id} - ${userEmail}, Created: ${w.created_at})`);
            }
            console.log('');
          }
        } else {
          console.log('✅ No duplicate wallet addresses found in entire database');
        }
      }
    }

    if (issues.length === 0) {
      console.log('✅ No issues detected!');
    } else {
      console.log('ISSUES DETECTED:');
      issues.forEach(issue => console.log(`  ${issue}`));
    }

    console.log('\nRECOMMENDATIONS:');
    if (matchingUsers.length > 1) {
      console.log(`  1. Keep oldest user: ${oldestUser.id}`);
      console.log(`  2. Delete newest user: ${newestUser.id}`);
    }
    
    if (wallets && wallets.length > 1) {
      const oldestWallet = wallets.sort((a, b) => 
        new Date(a.created_at) - new Date(b.created_at)
      )[0];
      console.log(`  3. Keep oldest wallet: ${oldestWallet.id}`);
      console.log(`  4. Delete duplicate wallets`);
    }

    console.log('\n✅ Run FIX_DUPLICATE_EMAIL_ACCOUNTS.sql to fix all issues');
    console.log('========================================\n');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkDuplicateAccount();

