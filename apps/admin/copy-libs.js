const fs = require('fs');
const path = require('path');

console.log('📦 Preparing lib/ folder for build...');

const sourceLib = path.join(__dirname, '../../lib');
const targetLib = path.join(__dirname, 'lib');
const adminSpecificFiles = ['admin-auth-utils.ts']; // Files that should stay in apps/admin/lib

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    const files = fs.readdirSync(src);
    files.forEach(file => {
      copyRecursive(path.join(src, file), path.join(dest, file));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

// Check if we're in a monorepo (source lib exists)
if (fs.existsSync(sourceLib)) {
  console.log('✅ Monorepo detected - syncing lib/ folder');
  
  // Backup admin-specific files
  const backups = {};
  adminSpecificFiles.forEach(file => {
    const filePath = path.join(targetLib, file);
    if (fs.existsSync(filePath)) {
      backups[file] = fs.readFileSync(filePath);
      console.log(`  💾 Backed up: ${file}`);
    }
  });
  
  // Remove old target
  if (fs.existsSync(targetLib)) {
    fs.rmSync(targetLib, { recursive: true });
  }
  
  // Create target dir
  fs.mkdirSync(targetLib, { recursive: true });
  
  // Copy all files recursively from root
  const files = fs.readdirSync(sourceLib);
  files.forEach(file => {
    const src = path.join(sourceLib, file);
    const dest = path.join(targetLib, file);
    copyRecursive(src, dest);
  });
  
  console.log(`✅ Copied ${files.length} items from ../../lib/`);
  
  // Restore admin-specific files
  Object.keys(backups).forEach(file => {
    const filePath = path.join(targetLib, file);
    fs.writeFileSync(filePath, backups[file]);
    console.log(`  ✅ Restored: ${file}`);
  });
  
  console.log('✅ lib/ folder ready for build');
} else {
  console.log('ℹ️  Not in monorepo (Vercel deployment)');
  console.log('ℹ️  Using committed lib/ folder');
  
  if (!fs.existsSync(targetLib)) {
    console.error('❌ lib/ folder not found!');
    console.error('   Make sure apps/admin/lib/ is committed to git');
    process.exit(1);
  }
  
  const libFiles = fs.readdirSync(targetLib);
  console.log(`✅ lib/ folder exists with ${libFiles.length} items`);
  
  // Verify critical files
  const criticalFiles = ['admin-auth-utils.ts', 'logger.ts', 'supabase.ts'];
  const missing = criticalFiles.filter(f => !fs.existsSync(path.join(targetLib, f)));
  
  if (missing.length > 0) {
    console.error(`❌ Missing critical files: ${missing.join(', ')}`);
    process.exit(1);
  }
  
  console.log('✅ All critical files present');
}
