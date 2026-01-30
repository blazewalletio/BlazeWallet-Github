// ===============================================
// DEVICE VERIFICATION DEBUG SCRIPT
// Run dit in browser console om EXACT te zien wat er gebeurt
// ===============================================

async function debugDeviceVerification() {
  console.log('🔍 ===============================================');
  console.log('🔍 DEVICE VERIFICATION DEBUG - START');
  console.log('🔍 ===============================================\n');
  
  // Import modules
  const { supabase } = await import('./lib/supabase');
  const { generateEnhancedFingerprint } = await import('./lib/device-fingerprint-pro');
  const { DeviceVerificationCheck } = await import('./lib/device-verification-check');
  
  // ===============================================
  // STEP 1: CHECK LOCALSTORAGE STATE
  // ===============================================
  console.log('\n📦 STEP 1: LocalStorage State');
  console.log('═══════════════════════════════════════════════\n');
  
  const localStorageState = {
    has_password: localStorage.getItem('has_password'),
    encrypted_wallet: !!localStorage.getItem('encrypted_wallet'),
    encrypted_wallet_length: localStorage.getItem('encrypted_wallet')?.length,
    wallet_created_with_email: localStorage.getItem('wallet_created_with_email'),
    wallet_email: localStorage.getItem('wallet_email'),
    supabase_user_id: localStorage.getItem('supabase_user_id'),
  };
  
  console.log('LocalStorage:', localStorageState);
  
  // ===============================================
  // STEP 2: CHECK SUPABASE SESSION
  // ===============================================
  console.log('\n🔐 STEP 2: Supabase Session Check');
  console.log('═══════════════════════════════════════════════\n');
  
  const sessionStart = Date.now();
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  const sessionDuration = Date.now() - sessionStart;
  
  console.log('getSession() duration:', sessionDuration + 'ms');
  console.log('Session exists:', !!session);
  console.log('Session error:', sessionError);
  
  if (session) {
    console.log('Session details:', {
      user_id: session.user.id,
      email: session.user.email,
      expires_at: new Date(session.expires_at * 1000).toISOString(),
      expires_in: Math.round((session.expires_at * 1000 - Date.now()) / 1000 / 60) + ' minutes',
      access_token_length: session.access_token?.length,
    });
  }
  
  // ===============================================
  // STEP 3: CHECK SUPABASE USER (API CALL)
  // ===============================================
  console.log('\n👤 STEP 3: Supabase User Check (API)');
  console.log('═══════════════════════════════════════════════\n');
  
  const userStart = Date.now();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  const userDuration = Date.now() - userStart;
  
  console.log('getUser() duration:', userDuration + 'ms');
  console.log('User exists:', !!user);
  console.log('User error:', userError);
  
  if (user) {
    console.log('User ID:', user.id);
    console.log('User email:', user.email);
  }
  
  // ===============================================
  // STEP 4: GENERATE FINGERPRINT (TWICE!)
  // ===============================================
  console.log('\n🖐️ STEP 4: Device Fingerprint Generation');
  console.log('═══════════════════════════════════════════════\n');
  
  console.log('Generating fingerprint #1...');
  const fp1Start = Date.now();
  const deviceInfo1 = await generateEnhancedFingerprint();
  const fp1Duration = Date.now() - fp1Start;
  
  console.log('Fingerprint #1 generated in:', fp1Duration + 'ms');
  console.log('Fingerprint #1:', deviceInfo1.fingerprint);
  console.log('Device name:', deviceInfo1.deviceName);
  console.log('Browser:', deviceInfo1.browser, deviceInfo1.browserVersion);
  console.log('OS:', deviceInfo1.os, deviceInfo1.osVersion);
  
  // Wait 100ms and generate again
  await new Promise(resolve => setTimeout(resolve, 100));
  
  console.log('\nGenerating fingerprint #2 (after 100ms)...');
  const fp2Start = Date.now();
  const deviceInfo2 = await generateEnhancedFingerprint();
  const fp2Duration = Date.now() - fp2Start;
  
  console.log('Fingerprint #2 generated in:', fp2Duration + 'ms');
  console.log('Fingerprint #2:', deviceInfo2.fingerprint);
  
  // ⚠️ CRITICAL CHECK
  const fingerprintsMatch = deviceInfo1.fingerprint === deviceInfo2.fingerprint;
  console.log('\n⚠️ FINGERPRINT CONSISTENCY CHECK:');
  console.log('Fingerprints match:', fingerprintsMatch ? '✅ YES' : '❌ NO');
  
  if (!fingerprintsMatch) {
    console.error('🚨 PROBLEM FOUND: Fingerprints are NOT consistent!');
    console.error('This means device verification will randomly fail!');
    console.error('FP1:', deviceInfo1.fingerprint);
    console.error('FP2:', deviceInfo2.fingerprint);
    
    // Find differences
    const fp1_parts = deviceInfo1.fingerprint.split('');
    const fp2_parts = deviceInfo2.fingerprint.split('');
    let diffCount = 0;
    for (let i = 0; i < fp1_parts.length; i++) {
      if (fp1_parts[i] !== fp2_parts[i]) {
        diffCount++;
      }
    }
    console.error('Difference:', diffCount, 'characters out of', fp1_parts.length);
  }
  
  // ===============================================
  // STEP 5: CHECK DATABASE FOR DEVICES
  // ===============================================
  console.log('\n💾 STEP 5: Database Device Check');
  console.log('═══════════════════════════════════════════════\n');
  
  if (!user) {
    console.error('❌ Cannot check database - no user session');
  } else {
    console.log('Querying trusted_devices for user:', user.id);
    
    // Query ALL devices for this user
    const dbStart = Date.now();
    const { data: allDevices, error: dbError } = await supabase
      .from('trusted_devices')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    const dbDuration = Date.now() - dbStart;
    
    console.log('Database query duration:', dbDuration + 'ms');
    console.log('Database error:', dbError);
    console.log('Total devices found:', allDevices?.length || 0);
    
    if (allDevices && allDevices.length > 0) {
      console.log('\nDevices in database:');
      allDevices.forEach((device, index) => {
        console.log(`\nDevice #${index + 1}:`);
        console.log('  ID:', device.id);
        console.log('  Fingerprint:', device.device_fingerprint);
        console.log('  Device name:', device.device_name);
        console.log('  Verified:', !!device.verified_at);
        console.log('  Verified at:', device.verified_at);
        console.log('  Created at:', device.created_at);
        console.log('  Last used:', device.last_used_at);
        console.log('  Is current:', device.is_current);
        
        // ⚠️ CRITICAL: Check if current fingerprint matches
        const matchesCurrent = device.device_fingerprint === deviceInfo1.fingerprint;
        console.log('  Matches current FP:', matchesCurrent ? '✅ YES' : '❌ NO');
        
        if (!matchesCurrent) {
          // Show difference
          const stored = device.device_fingerprint;
          const current = deviceInfo1.fingerprint;
          console.log('  Stored FP :', stored);
          console.log('  Current FP:', current);
          
          if (stored && current) {
            let diffCount = 0;
            const minLen = Math.min(stored.length, current.length);
            for (let i = 0; i < minLen; i++) {
              if (stored[i] !== current[i]) diffCount++;
            }
            console.log('  Difference:', diffCount, 'chars out of', minLen);
          }
        }
      });
      
      // Check if ANY device matches current fingerprint
      const matchingDevice = allDevices.find(d => 
        d.device_fingerprint === deviceInfo1.fingerprint && 
        d.verified_at
      );
      
      console.log('\n⚠️ DEVICE MATCH CHECK:');
      if (matchingDevice) {
        console.log('✅ Found verified device with matching fingerprint');
        console.log('Device should be recognized!');
      } else {
        console.error('❌ NO verified device with matching fingerprint!');
        console.error('This explains why device check fails!');
        
        const verifiedDevices = allDevices.filter(d => d.verified_at);
        if (verifiedDevices.length > 0) {
          console.error('Problem: Verified devices exist, but fingerprint doesn\'t match');
          console.error('This is a FINGERPRINT INCONSISTENCY problem!');
        } else {
          console.error('Problem: No verified devices at all');
          console.error('User needs to verify device first!');
        }
      }
    } else {
      console.log('No devices found in database for this user');
    }
  }
  
  // ===============================================
  // STEP 6: RUN ACTUAL DEVICE VERIFICATION CHECK
  // ===============================================
  console.log('\n✅ STEP 6: Actual Device Verification Check');
  console.log('═══════════════════════════════════════════════\n');
  
  const checkStart = Date.now();
  const deviceCheck = await DeviceVerificationCheck.isDeviceVerified();
  const checkDuration = Date.now() - checkStart;
  
  console.log('DeviceVerificationCheck.isDeviceVerified() duration:', checkDuration + 'ms');
  console.log('Result:', deviceCheck);
  console.log('Verified:', deviceCheck.verified ? '✅ YES' : '❌ NO');
  console.log('Reason:', deviceCheck.reason || 'N/A');
  
  // ===============================================
  // STEP 7: SUMMARY & DIAGNOSIS
  // ===============================================
  console.log('\n📊 STEP 7: DIAGNOSIS');
  console.log('═══════════════════════════════════════════════\n');
  
  const diagnosis = {
    localStorageOK: localStorageState.has_password === 'true' && localStorageState.encrypted_wallet,
    sessionExists: !!session,
    userExists: !!user,
    fingerprintConsistent: fingerprintsMatch,
    deviceVerified: deviceCheck.verified,
  };
  
  console.log('Diagnosis:', diagnosis);
  
  // Determine root cause
  console.log('\n🎯 ROOT CAUSE:');
  
  if (!diagnosis.sessionExists) {
    console.error('❌ PROBLEM: No Supabase session');
    console.error('→ User needs to login again');
  } else if (!diagnosis.userExists) {
    console.error('❌ PROBLEM: getUser() API call failed');
    console.error('→ Network issue or session token invalid');
  } else if (!diagnosis.fingerprintConsistent) {
    console.error('❌ PROBLEM: Fingerprint is NOT consistent!');
    console.error('→ This is why device verification randomly fails');
    console.error('→ FIX: Need to implement device trust token');
  } else if (!diagnosis.deviceVerified) {
    if (allDevices && allDevices.length > 0) {
      console.error('❌ PROBLEM: Device exists but fingerprint doesn\'t match');
      console.error('→ Fingerprint changed since verification');
      console.error('→ FIX: Need device trust token or fuzzy matching');
    } else {
      console.error('❌ PROBLEM: Device not verified in database');
      console.error('→ User needs to verify device first');
    }
  } else {
    console.log('✅ Everything OK - device is verified!');
  }
  
  console.log('\n🔍 ===============================================');
  console.log('🔍 DEVICE VERIFICATION DEBUG - END');
  console.log('🔍 ===============================================\n');
  
  return diagnosis;
}

// Export for console use
if (typeof window !== 'undefined') {
  window.debugDeviceVerification = debugDeviceVerification;
  console.log('✅ Debug function loaded!');
  console.log('Run: debugDeviceVerification()');
}

