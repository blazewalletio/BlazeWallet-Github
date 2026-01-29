const fs = require('fs');
const path = require('path');

console.log('📦 Preparing lib/ folder for build...');

const sourceLib = path.join(__dirname, '../../lib');
const targetLib = path.join(__dirname, 'lib');

// Check if we're in a monorepo (source lib exists)
if (fs.existsSync(sourceLib)) {
  console.log('✅ Monorepo detected - lib/ will be synced from ../../lib/');
  console.log('ℹ️  This is a LOCAL development build');
} else {
  console.log('✅ Standalone deployment detected (Vercel)');
  console.log('ℹ️  Using committed lib/ folder from apps/admin/lib/');
  
  if (!fs.existsSync(targetLib)) {
    console.error('❌ FATAL: lib/ folder not found!');
    console.error('   Expected location: apps/admin/lib/');
    console.error('   This folder must be committed to git for Vercel deployment');
    process.exit(1);
  }
  
  const libFiles = fs.readdirSync(targetLib);
  console.log(`✅ Found lib/ folder with ${libFiles.length} files`);
  
  // Verify critical files
  const criticalFiles = ['admin-auth-utils.ts', 'logger.ts', 'supabase.ts'];
  const missing = criticalFiles.filter(f => !fs.existsSync(path.join(targetLib, f)));
  
  if (missing.length > 0) {
    console.error(`❌ FATAL: Missing critical lib files: ${missing.join(', ')}`);
    process.exit(1);
  }
  
  console.log('✅ All critical files present - build can proceed');
}

console.log('✅ Prebuild check complete!');
