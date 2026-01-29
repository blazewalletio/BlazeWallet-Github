const fs = require('fs');
const path = require('path');

console.log('📦 Preparing lib/ folder for build...');

const sourceLib = path.join(__dirname, '../../lib');
const targetLib = path.join(__dirname, 'lib');
const adminLibBackup = path.join(__dirname, 'lib-admin-backup');

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

// Step 1: Backup admin-specific lib files if they exist
if (fs.existsSync(targetLib)) {
  console.log('ℹ️  Backing up admin-specific lib files...');
  
  if (fs.existsSync(adminLibBackup)) {
    fs.rmSync(adminLibBackup, { recursive: true });
  }
  
  copyRecursive(targetLib, adminLibBackup);
  console.log('✅ Admin lib files backed up');
}

// Step 2: Check if source lib exists (monorepo)
if (fs.existsSync(sourceLib)) {
  console.log('✅ Found root lib/ folder, copying recursively...');
  
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
  
  console.log(`✅ Copied ${files.length} items from ../../lib/ to lib/`);
  
  // Step 3: Restore admin-specific files (overwrite if needed)
  if (fs.existsSync(adminLibBackup)) {
    console.log('ℹ️  Restoring admin-specific lib files...');
    
    const adminFiles = fs.readdirSync(adminLibBackup);
    adminFiles.forEach(file => {
      const src = path.join(adminLibBackup, file);
      const dest = path.join(targetLib, file);
      
      // Only copy if it's admin-specific (contains "admin" in name)
      if (file.includes('admin')) {
        fs.copyFileSync(src, dest);
        console.log(`  ✅ Restored: ${file}`);
      }
    });
    
    // Clean up backup
    fs.rmSync(adminLibBackup, { recursive: true });
  }
  
  console.log('✅ Lib folder ready for build!');
} else {
  console.log('ℹ️  No root lib/ found (probably on Vercel), assuming lib/ already complete');
  
  if (!fs.existsSync(targetLib)) {
    console.error('❌ lib/ folder not found! Build will fail.');
    process.exit(1);
  } else {
    console.log('✅ lib/ folder exists, continuing build');
  }
}
